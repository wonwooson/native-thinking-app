import { useState, useEffect, useRef } from 'react';
import './index.css';
import InputScreen from './components/InputScreen';
import LearningScreen from './components/LearningScreen';
import ReviewList from './components/ReviewList';
import TimelineSelector from './components/TimelineSelector';
import type { TranscriptItem } from './components/TimelineSelector';
import type { AppState, AnalysisData, HistoryItem, InputHistoryItem, DocumentItem } from './types';
import { BookOpen, LogOut, Library, Lightbulb, Home, XCircle } from 'lucide-react';
import { auth, db } from './lib/firebase';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc, addDoc, getCountFromServer } from 'firebase/firestore';
import AuthScreen from './components/AuthScreen';
import DocumentListScreen from './components/DocumentListScreen';
import DocumentReaderScreen from './components/DocumentReaderScreen';
import AhaCollectionScreen from './components/AhaCollectionScreen';
import ResetPasswordScreen from './components/ResetPasswordScreen';
import { useSwipeable } from 'react-swipeable';

// In production, the API and frontend share the exact same domain.
// In development, Vite will proxy relative '/api' requests to port 3001 automatically.
const API_BASE_URL = '';

function App() {
  const [appState, setAppState] = useState<AppState>('input');
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [inputHistory, setInputHistory] = useState<InputHistoryItem[]>([]);
  const [analyzingStep, setAnalyzingStep] = useState<'fetching' | 'analyzing'>('fetching');
  const [currentInput, setCurrentInput] = useState<{ text: string, isLink: boolean, batchCount: number, parsedSentences?: string[], fullText?: string } | null>(null);
  const [currentDocument, setCurrentDocument] = useState<DocumentItem | null>(null);
  const previousState = useRef<AppState>('input');

  const [ahaModalInfo, setAhaModalInfo] = useState<{ phrase: string, preposition: string, context?: string } | null>(null);
  const [userNote, setUserNote] = useState('');
  const [isSavingAha, setIsSavingAha] = useState(false);

  // Timeline Selection
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([]);
  const [pendingAnalysisUrl, setPendingAnalysisUrl] = useState('');

  // Gamification State (Derived from content)
  const [ahaCount, setAhaCount] = useState<number>(0);
  const brainSyncScore = (history.length * 15) + (ahaCount * 10);

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Exit Logic State
  const [showExitToast, setShowExitToast] = useState(false);
  const lastBackPressTime = useRef<number>(0);

  // Swipe Navigation Handlers
  const SWIPE_TABS: AppState[] = ['input', 'document_list', 'review_list', 'aha_collection'];

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (appState === 'learning' || appState === 'document_reader' || appState === 'analyzing') return;
      const currentIndex = SWIPE_TABS.indexOf(appState);
      if (currentIndex !== -1) {
        setAppState(SWIPE_TABS[(currentIndex + 1) % SWIPE_TABS.length]);
      }
    },
    onSwipedRight: () => {
      if (appState === 'learning' || appState === 'document_reader' || appState === 'analyzing') return;
      const currentIndex = SWIPE_TABS.indexOf(appState);
      if (currentIndex !== -1) {
        setAppState(SWIPE_TABS[(currentIndex - 1 + SWIPE_TABS.length) % SWIPE_TABS.length]);
      }
    },
    trackMouse: false
  });

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Centralized History & Navigation Controller (Double-Layer Trap)
  useEffect(() => {
    // 1. Setup: Ensure we have a "Root" and a "Guard" on the home screen
    if (appState === 'input') {
      const state = window.history.state;
      if (!state || (!state.isRoot && !state.isExitGuard)) {
        // We land here: replace current with Root, and push a Guard on top
        window.history.replaceState({ appState: 'input', isRoot: true }, '', '#input');
        window.history.pushState({ appState: 'input', isExitGuard: true }, '', '#input');
      }
    } else {
      // Normal push for other states if they are not the current state
      if (!window.history.state || window.history.state.appState !== appState) {
        window.history.pushState({ appState, isExitGuard: false, isRoot: false }, '', `#${appState}`);
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;

      // LOGIC: If we were on 'input' with Guard, and user presses back, 
      // they land on 'Root' or some earlier state.
      if (appState === 'input' && (!state || !state.isExitGuard)) {
        const now = Date.now();
        if (now - lastBackPressTime.current < 2000) {
          // Double click: actually leave the site
          window.history.go(-1);
          return;
        } else {
          // First back: Show toast and re-push the Guard
          lastBackPressTime.current = now;
          setShowExitToast(true);
          setTimeout(() => setShowExitToast(false), 2000);

          window.history.pushState({ appState: 'input', isExitGuard: true }, '', '#input');
          return;
        }
      }

      // Normal navigation
      if (state && state.appState) {
        setAppState(state.appState);
      } else {
        const hash = window.location.hash.replace('#', '');
        if (hash && hash !== appState) {
          setAppState(hash as AppState);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [appState]);

  // Load history from Firebase safely when user is logged in
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // Fetch Review List
        const revQuery = query(collection(db, 'review_list'), where('user_id', '==', user.uid));
        const revSnap = await getDocs(revQuery);
        const mappedHistory = revSnap.docs.map(r => {
          const data = r.data();
          return {
            id: r.id,
            title: data.title,
            date: data.created_at,
            data: data.analysis_data
          };
        }).sort((a, b) => b.date.localeCompare(a.date));
        setHistory(mappedHistory);

        // Fetch Input History
        const inpQuery = query(collection(db, 'input_history'), where('user_id', '==', user.uid));
        const inpSnap = await getDocs(inpQuery);
        const mappedInputs = inpSnap.docs.map(i => {
          const data = i.data();
          let fullText = data.full_text || "";
          let guideText = undefined;
          if (fullText.includes("===SPEAKING_GUIDE===")) {
            const parts = fullText.split("===SPEAKING_GUIDE===");
            fullText = parts[0].trim();
            guideText = parts[1].trim();
          }
          return {
            id: i.id,
            text: data.text,
            isLink: data.is_link,
            batchCount: data.batch_count,
            parsedSentences: data.parsed_sentences,
            fullText,
            guideText,
            date: data.created_at
          };
        }).sort((a, b) => b.date.localeCompare(a.date));
        setInputHistory(mappedInputs);

        // Fetch Aha Count
        const countSnap = await getCountFromServer(query(collection(db, 'aha_moments'), where('user_id', '==', user.uid)));
        setAhaCount(countSnap.data().count || 0);

      } catch (e) {
        console.error("Failed to load data from Firebase", e);
      }
    };

    loadData();
  }, [user]);

  const clearHistory = async () => {
    if (!user) return;
    if (!window.confirm("모든 학습 기록(복습 리스트, 아하! 콜렉션)과 XP 점수가 초기화됩니다. 계속하시겠습니까?")) return;

    try {
      // 1. Clear review_list
      const revQuery = query(collection(db, 'review_list'), where('user_id', '==', user.uid));
      const revSnap = await getDocs(revQuery);
      revSnap.forEach(async (document) => await deleteDoc(doc(db, 'review_list', document.id)));

      // 2. Clear aha_moments
      const ahaQuery = query(collection(db, 'aha_moments'), where('user_id', '==', user.uid));
      const ahaSnap = await getDocs(ahaQuery);
      ahaSnap.forEach(async (document) => await deleteDoc(doc(db, 'aha_moments', document.id)));

      // 3. Update Local State
      setHistory([]);
      setAhaCount(0);
      alert("🎉 모든 데이터가 깨끗하게 초기화되었습니다. 처음부터 다시 시작해보세요!");
    } catch (e) {
      console.error("Reset failed:", e);
      alert("초기화 중 오류가 발생했습니다.");
    }
  };

  const deleteReviewItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'review_list', id));
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const updateBrainSyncScore = async (amount: number) => {
    // Since XP is now derived from history length and ahaCount, 
    // manual score updates are logged but don't affect base score directly.
    console.log("Manual XP update requested:", amount);
  };

  const handleSaveSpeakingGuide = async (docId: string, newGuideText: string, originalFullText: string) => {
    if (!user) return;
    try {
      const combinedText = originalFullText.trim() + "\n\n===SPEAKING_GUIDE===\n\n" + newGuideText.trim();
      await updateDoc(doc(db, 'input_history', docId), { full_text: combinedText });
      setInputHistory(prev => prev.map(item => item.id === docId ? { ...item, guideText: newGuideText } : item));
      if (currentDocument && currentDocument.id === docId) {
        setCurrentDocument(prev => prev ? { ...prev, guideText: newGuideText } : null);
      }
    } catch (e) {
      console.error("Failed to save guide to DB", e);
    }
  };

  const handleStartAnalysisClick = async (inputText: string, isLink: boolean, batchCount: number = 0, existingSentences?: string[], existingFullText?: string) => {
    // If it's a new link analysis, fetch transcript and show timeline selector
    if (isLink && !existingFullText && batchCount === 0) {
      setAnalyzingStep('fetching');
      setAppState('analyzing');
      try {
        console.time('[FastTrack] Fetch Transcript');
        const transRes = await fetch(`${API_BASE_URL}/api/fetch-transcript`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: inputText })
        });
        console.timeEnd('[FastTrack] Fetch Transcript');
        if (!transRes.ok) {
          const err = await transRes.json();
          throw new Error(err.error || "Failed to fetch YouTube transcript");
        }
        const transData = await transRes.json();
        
        if (transData.items && transData.items.length > 0) {
          setTranscriptItems(transData.items);
          setPendingAnalysisUrl(inputText);
          setAppState('selecting_timeline');
        } else {
          // fallback if no items
          startAnalysis(inputText, isLink, batchCount, existingSentences, transData.text);
        }
      } catch (error: any) {
        console.error("API Call failed:", error);
        alert("자막을 가져오는 중 오류가 발생했습니다: " + error.message);
        setAppState('input');
      }
      return;
    }

    // Otherwise, directly start analysis
    startAnalysis(inputText, isLink, batchCount, existingSentences, existingFullText);
  };

  const startAnalysis = async (inputText: string, isLink: boolean, batchCount: number = 0, existingSentences?: string[], existingFullText?: string) => {
    previousState.current = appState;
    // We store raw text in existingFullText
    setCurrentInput({ text: inputText, isLink, batchCount, parsedSentences: existingSentences, fullText: existingFullText });
    setAnalyzingStep('analyzing');
    setAppState('analyzing');

    try {
      console.time('[FastTrack] Total Time');
      let rawText = existingFullText || inputText;

      if (!rawText) throw new Error("No text available to analyze");

      // AI Punctuation check (only on first batch)
      if (batchCount === 0) {
          const punctuationCount = (rawText.match(/[.!?]/g) || []).length;
          const wordCount = rawText.split(/\s+/).length;
          // If fewer than 1 punctuation per 25 words (4%), we add punctuation
          if (wordCount > 15 && (punctuationCount / wordCount) < 0.04) {
              console.time('[FastTrack] Add Punctuation');
              const puncRes = await fetch(`${API_BASE_URL}/api/add-punctuation`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: rawText })
              });
              console.timeEnd('[FastTrack] Add Punctuation');
              if (puncRes.ok) {
                  const puncData = await puncRes.json();
                  if (puncData.text) rawText = puncData.text;
                  
                  // Update current input context so next batches use punctuated text
                  setCurrentInput({ text: inputText, isLink, batchCount, parsedSentences: existingSentences, fullText: rawText });
              }
          }
      }

      // Split into sentences for safe chunking to prevent mid-sentence cuts
      const sentences = rawText.match(/[^.!?]+[.!?]+/g) || [rawText];
      const CHUNK_SIZE = 10; // Process 10 sentences at a time
      
      const startIndex = batchCount * CHUNK_SIZE;
      if (startIndex >= sentences.length) {
        alert("🎉 이 텍스트의 모든 내용을 학습하셨습니다! 처음부터 다시 시작합니다.");
        console.timeEnd('[FastTrack] Total Time');
        startAnalysis(inputText, isLink, 0, undefined, rawText);
        return;
      }

      const chunkSentences = sentences.slice(startIndex, startIndex + CHUNK_SIZE);
      const fastTrackSlice = chunkSentences.join(' ');
      const hasMore = sentences.length > startIndex + CHUNK_SIZE;

      console.time('[FastTrack] Analyze Fast API');
      const fastRes = await fetch(`${API_BASE_URL}/api/analyze-fast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fastTrackSlice })
      });
      console.timeEnd('[FastTrack] Analyze Fast API');

      if (!fastRes.ok) {
        const err = await fastRes.json();
        throw new Error(err.error || "Failed to analyze text chunk");
      }

      const fastData = await fastRes.json();
      const analysisData = fastData.analysisData;
      analysisData.hasMore = hasMore;
      
      // Store rawText in fullText so next batch can reuse it
      analysisData.inputContext = { text: inputText, isLink, batchCount, parsedSentences: [], fullText: rawText };
      setCurrentInput(analysisData.inputContext);

      // Save to Input History (only on first batch)
      if (user && batchCount === 0) {
        try {
          const createdAt = new Date().toISOString();
          // We save rawText as full_text so history can resume
          const docRef = await addDoc(collection(db, 'input_history'), {
            user_id: user.uid,
            text: inputText,
            is_link: isLink,
            batch_count: 0,
            full_text: rawText,
            created_at: createdAt
          });

          setInputHistory(prev => {
            const newHistory = [{
              id: docRef.id,
              text: inputText,
              isLink: isLink,
              batchCount: 0,
              fullText: rawText,
              date: createdAt
            }, ...prev.filter(i => i.text !== inputText)].slice(0, 5);
            return newHistory;
          });
        } catch (e) {
          console.error("Input history save failed", e);
        }
      }

      handleAnalysisComplete(analysisData);
      console.timeEnd('[FastTrack] Total Time');
    } catch (error: any) {
      console.error("API Call failed:", error);
      alert("분석 중 오류가 발생했습니다: " + error.message);
      setAppState('input');
      console.timeEnd('[FastTrack] Total Time');
    }
  };

  const handleAnalysisComplete = async (data: AnalysisData) => {
    if (currentInput) {
      data.inputContext = currentInput;
    }
    setAnalysisData(data);
    setAppState('learning');

    if (!user) return;

    // Automatically save to review_list DB when analysis completes
    const title = data.word_order[0]?.original || "새로운 영어 표현 학습";

    // Prevent duplicates in state first
    if (history.length > 0 && history[0].title === title) {
      return;
    }

    try {
      const createdAt = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'review_list'), {
        user_id: user.uid,
        title: title,
        analysis_data: data,
        created_at: createdAt
      });

      const newItem: HistoryItem = {
        id: docRef.id,
        title: title,
        date: createdAt,
        data: data
      };
      setHistory(prev => [newItem, ...prev]);

      // Reward the user with points for completing an analysis!
      updateBrainSyncScore(15);
    } catch (e) {
      console.error("Review list save failed", e);
    }
  };

  const handleCancelAnalysis = () => {
    window.history.back();
  };

  const returnHome = () => {
    window.history.back();
    setTimeout(() => setAnalysisData(null), 100);
  };

  const handleSaveAha = async () => {
    if (!user || !ahaModalInfo) return;
    setIsSavingAha(true);
    try {
      const contextPayload = ahaModalInfo.context ? `${ahaModalInfo.context}\n\n[나의 깨달음/질문]\n${userNote}` : userNote;

      const createdAt = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'aha_moments'), {
        user_id: user.uid,
        original_phrase: ahaModalInfo.phrase,
        preposition: ahaModalInfo.preposition,
        user_note: userNote,
        ai_conversation: [
          { role: 'user', content: contextPayload }
        ],
        created_at: createdAt
      });

      setAhaCount(prev => prev + 1);

      // Trigger AI feedback in the background
      fetch('/api/chat-aha-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: [{ role: 'user', content: contextPayload }] })
      }).then(res => res.json()).then(async (apiRes) => {
        if (apiRes.reply) {
          const finalConversation = [{ role: 'user', content: contextPayload }, { role: 'model', content: apiRes.reply }];
          await updateDoc(doc(db, 'aha_moments', docRef.id), { ai_conversation: finalConversation });
        }
      }).catch(err => console.error("AI Feedback error:", err));

      setAhaModalInfo(null);
      setUserNote('');
      alert("✨ 아하! 모먼트가 컬렉션에 저장되었습니다.");
      setAppState('aha_collection');
    } catch (e: any) {
      console.error(e);
      alert("저장에 실패했습니다: " + e.message);
    } finally {
      setIsSavingAha(false);
    }
  };

  const handleNextBatch = () => {
    if (currentInput) {
      const nextBatchCount = (currentInput.batchCount != null ? currentInput.batchCount : 0) + 1;
      startAnalysis(currentInput.text, currentInput.isLink, nextBatchCount, currentInput.parsedSentences, currentInput.fullText);
    } else {
      alert("죄송합니다. 이전에 저장된 오래된 복습 노트에서는 '다음 문장 분석'을 이어서 할 수 없습니다. '분석 시작하기' 화면의 최근 기록 목록을 이용해 주세요.");
    }
  };

  if (authLoading) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'var(--text-muted)' }}>
        로딩 중...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-container">
        <AuthScreen onSuccess={() => { }} />
      </div>
    );
  }

  return (
    <div className="app-container" {...swipeHandlers}>
      {/* Global Navigation Header for logged-in users */}
      {appState !== 'analyzing' && appState !== 'reset_password' && user && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', padding: '16px 24px 0', zIndex: 10 }}>
          <button
            onClick={() => setAppState('input')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: appState === 'input' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <Home size={24} className={appState === 'input' ? "text-blue-500 fill-blue-100" : ""} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>홈</span>
          </button>
          <button
            onClick={() => setAppState('document_list')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: appState === 'document_list' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <Library size={24} className={appState === 'document_list' ? "text-blue-500 fill-blue-100" : ""} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>원문 보관함</span>
          </button>
          <button
            onClick={() => setAppState('review_list')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: appState === 'review_list' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <BookOpen size={24} className={appState === 'review_list' ? "text-blue-500 fill-blue-100" : ""} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>오늘의 복습</span>
          </button>
          <button
            onClick={() => setAppState('aha_collection')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: appState === 'aha_collection' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <Lightbulb size={24} className={appState === 'aha_collection' ? "text-amber-500 fill-amber-100" : ""} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>아하!</span>
          </button>
          <button
            onClick={() => signOut(auth)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <LogOut size={24} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>로그아웃</span>
          </button>
        </div>
      )}

      {(appState === 'input' || appState === 'analyzing') && (
        <div style={{ position: 'relative' }}>
          <InputScreen
            isAnalyzing={appState === 'analyzing'}
            analyzingStep={analyzingStep}
            onStart={handleStartAnalysisClick}
            onCancel={handleCancelAnalysis}
            inputHistory={inputHistory}
            score={brainSyncScore}
            onScoreClick={() => setAppState('input')}
          />
        </div>
      )}

      {appState === 'selecting_timeline' && (
        <TimelineSelector
          items={transcriptItems}
          onConfirm={(selectedText) => {
            startAnalysis(pendingAnalysisUrl, true, 0, undefined, selectedText);
          }}
          onCancel={() => setAppState('input')}
        />
      )}

      {appState === 'learning' && analysisData && (
        <LearningScreen
          data={analysisData}
          onBack={returnHome}
          onNextBatch={handleNextBatch}
          user={user}
          onScoreUpdate={(amount) => updateBrainSyncScore(amount)}
          onAhaRequest={(phrase: string, prep: string, context?: string) => {
            setAhaModalInfo({ phrase, preposition: prep, context });
            setUserNote('');
          }}
        />
      )}

      {appState === 'review_list' && (
        <ReviewList
          history={history}
          onSelect={(item) => {
            previousState.current = 'review_list';
            setAnalysisData(item.data);
            if (item.data.inputContext) {
              setCurrentInput(item.data.inputContext);
            } else {
              setCurrentInput(null);
            }
            setAppState('learning');
          }}
          onBack={() => setAppState('input')}
          onClear={clearHistory}
          onDelete={deleteReviewItem}
        />
      )}

      {appState === 'document_list' && (
        <DocumentListScreen
          inputHistory={inputHistory}
          onSelect={(doc) => {
            previousState.current = 'document_list';
            setCurrentDocument(doc);
            setAppState('document_reader');
          }}
          onBack={() => setAppState('input')}
          onDelete={async (docText) => {
            if (!user) return;
            try {
              const inpQuery = query(collection(db, 'input_history'), where('user_id', '==', user.uid), where('text', '==', docText));
              const querySnapshot = await getDocs(inpQuery);
              querySnapshot.forEach(async (document) => {
                await deleteDoc(doc(db, 'input_history', document.id));
              });
              setInputHistory(prev => prev.filter(item => item.text !== docText));
            } catch (e) { console.error(e); }
          }}
        />
      )}

      {appState === 'document_reader' && currentDocument && (
        <DocumentReaderScreen
          document={currentDocument}
          onBack={() => {
            setAppState('document_list');
            setTimeout(() => setCurrentDocument(null), 100);
          }}
          onSaveGuide={handleSaveSpeakingGuide}
        />
      )}

      {appState === 'aha_collection' && user && (
        <AhaCollectionScreen
          user={user}
          onBack={() => setAppState('input')}
          onCountChange={(count) => setAhaCount(count)}
        />
      )}



      {appState === 'reset_password' && (
        <ResetPasswordScreen onComplete={() => setAppState('input')} />
      )}

      {ahaModalInfo && (
        <div className="bottom-sheet-overlay animate-fade" onClick={() => setAhaModalInfo(null)}>
          <div
            className="bottom-sheet-content animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '4px', backgroundColor: '#e2e8eb', borderRadius: '2px', margin: '12px auto' }}></div>

            <div style={{ backgroundColor: '#fef3c7', padding: '16px 20px', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lightbulb size={24} className="text-amber-500 fill-amber-100" />
                <h3 style={{ margin: 0, fontSize: '18px', color: '#b45309', fontWeight: 700 }}>아하! 모먼트 저장</h3>
              </div>
              <button onClick={() => setAhaModalInfo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b45309', padding: '4px' }}>
                <XCircle size={24} />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '20px' }}>
                <span style={{ backgroundColor: '#f3f4f6', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>
                  {ahaModalInfo.preposition}
                </span>
                <h4 style={{ fontSize: '22px', fontWeight: 800, marginTop: '12px', marginBottom: '8px', color: '#1f2937', lineHeight: 1.3 }}>
                  {ahaModalInfo.phrase}
                </h4>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                  어떤 깨달음을 얻었나요? 질문을 적어주셔도 좋아요.
                </label>
                <textarea
                  placeholder="(선택) 어떻게 다르게 느껴졌는지, 또는 AI 원어민 튜터에게 궁금한 점을 적어주세요!"
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  rows={4}
                  style={{ width: '100%', padding: '14px', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '15px', resize: 'none', backgroundColor: '#f9fafb', fontFamily: 'inherit' }}
                />
              </div>

              <button
                onClick={handleSaveAha}
                disabled={isSavingAha}
                className="btn"
                style={{
                  width: '100%', padding: '18px', backgroundColor: '#f59e0b', color: 'white',
                  border: 'none', borderRadius: '14px', fontSize: '16px', fontWeight: 700,
                  cursor: isSavingAha ? 'not-allowed' : 'pointer', opacity: isSavingAha ? 0.7 : 1,
                  boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.2)'
                }}
              >
                {isSavingAha ? '저장 중...' : '노트에 추가하고 튜터에게 묻기'}
              </button>
              <div style={{ height: '24px' }}></div>
            </div>
          </div>
        </div>
      )}
      {/* Exit Toast Notification */}
      {showExitToast && (
        <div className="exit-toast">
          뒤로 버튼을 한번 더 누르시면 종료됩니다
        </div>
      )}
    </div>
  );
}

export default App;
