import { useState, useEffect, useRef } from 'react';
import './index.css';
import InputScreen from './components/InputScreen';
import LearningScreen from './components/LearningScreen';
import ReviewList from './components/ReviewList';
import type { AppState, AnalysisData, HistoryItem, InputHistoryItem, DocumentItem } from './types';
import { BookOpen, LogOut, Library, Lightbulb, LayoutDashboard, XCircle } from 'lucide-react';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';
import AuthScreen from './components/AuthScreen';
import DocumentListScreen from './components/DocumentListScreen';
import DocumentReaderScreen from './components/DocumentReaderScreen';
import AhaCollectionScreen from './components/AhaCollectionScreen';
import DashboardScreen from './components/DashboardScreen';
import { useSwipeable } from 'react-swipeable';

// In production, the API and frontend share the exact same domain.
// In development, Vite will proxy relative '/api' requests to port 3001 automatically.
const API_BASE_URL = '';

function App() {
  const [appState, setAppState] = useState<AppState>('input');
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [inputHistory, setInputHistory] = useState<InputHistoryItem[]>([]);
  const [currentInput, setCurrentInput] = useState<{ text: string, isLink: boolean, batchCount: number, parsedSentences?: string[], fullText?: string } | null>(null);
  const [currentDocument, setCurrentDocument] = useState<DocumentItem | null>(null);
  const previousState = useRef<AppState>('input');

  const [ahaModalInfo, setAhaModalInfo] = useState<{ phrase: string, preposition: string, context?: string } | null>(null);
  const [userNote, setUserNote] = useState('');
  const [isSavingAha, setIsSavingAha] = useState(false);

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
  const SWIPE_TABS: AppState[] = ['input', 'document_list', 'review_list', 'aha_collection', 'dashboard'];

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle mobile hardware back button by syncing appState with browser history
  useEffect(() => {
    // 1. When the component mounts, push the initial state into history
    window.history.replaceState({ appState: 'input' }, '', '#input');

    const handlePopState = (event: PopStateEvent) => {
      // 2. When the user presses the hardware back button, the popstate event fires

      // If we are at the home (input) state and user tries to go back
      if (appState === 'input' && (!event.state || event.state.appState === 'input')) {
        const now = Date.now();
        if (now - lastBackPressTime.current < 2000) {
          // Double back within 2s: Allow exit (do nothing special, let browser handle it)
          return;
        } else {
          // First back press: Block exit and show toast
          lastBackPressTime.current = now;
          setShowExitToast(true);
          setTimeout(() => setShowExitToast(false), 2000);

          // Re-push state to stay on 'input'
          window.history.pushState({ appState: 'input' }, '', '#input');
          return;
        }
      }

      if (event.state && event.state.appState) {
        setAppState(event.state.appState);
      } else {
        const hash = window.location.hash.replace('#', '');
        if (hash) {
          setAppState(hash as AppState);
        } else {
          setAppState('input');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [appState]); // Re-bind when appState changes to correctly check current location

  // 3. Keep the URL hash in sync whenever appState changes programmatically
  useEffect(() => {
    const currentHash = window.location.hash.replace('#', '');
    // Only push state if it's different from current hash to avoid infinite loops from popstate
    if (currentHash !== appState) {
      window.history.pushState({ appState }, '', `#${appState}`);
    }
  }, [appState]);

  // Load history from Supabase on mount safely when user is logged in
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        // Fetch Review List
        const { data: revData, error: revErr } = await supabase
          .from('review_list')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (revErr) throw revErr;

        if (revData) {
          const mappedHistory = revData.map(r => ({
            id: r.id,
            title: r.title,
            date: r.created_at,
            data: r.analysis_data
          }));
          setHistory(mappedHistory);
        }

        // Fetch Input History
        const { data: inpData, error: inpErr } = await supabase
          .from('input_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (inpErr) throw inpErr;

        if (inpData) {
          const mappedInputs = inpData.map(i => {
            let fullText = i.full_text || "";
            let guideText = undefined;
            if (fullText.includes("===SPEAKING_GUIDE===")) {
              const parts = fullText.split("===SPEAKING_GUIDE===");
              fullText = parts[0].trim();
              guideText = parts[1].trim();
            }
            return {
              id: i.id,
              text: i.text,
              isLink: i.is_link,
              batchCount: i.batch_count,
              parsedSentences: i.parsed_sentences,
              fullText,
              guideText,
              date: i.created_at
            };
          });
          setInputHistory(mappedInputs);
        }

        // Fetch Aha Count
        const { count: aCount, error: ahaErr } = await supabase
          .from('aha_moments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (!ahaErr) {
          setAhaCount(aCount || 0);
        }

        // We no longer strictly need brain_sync_score from user_profiles 
        // if we use a fully derived system. But we'll keep it for future manual bonuses.
      } catch (e) {
        console.error("Failed to load data from Supabase", e);
      }
    };

    loadData();
  }, [user]);

  const clearHistory = async () => {
    if (!user) return;
    if (!window.confirm("모든 학습 기록(복습 리스트, 아하! 콜렉션)과 XP 점수가 초기화됩니다. 계속하시겠습니까?")) return;

    try {
      // 1. Clear review_list
      await supabase.from('review_list').delete().eq('user_id', user.id);

      // 2. Clear aha_moments
      await supabase.from('aha_moments').delete().eq('user_id', user.id);

      // 3. Reset Brain Sync Score
      await supabase.from('user_profiles').update({ brain_sync_score: 0 }).eq('user_id', user.id);

      // 4. Update Local State
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
      const { error } = await supabase.from('review_list').delete().eq('id', id);
      if (!error) {
        setHistory(prev => prev.filter(item => item.id !== id));
      }
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
      const { error } = await supabase.from('input_history').update({ full_text: combinedText }).eq('id', docId);
      if (!error) {
        setInputHistory(prev => prev.map(item => item.id === docId ? { ...item, guideText: newGuideText } : item));
        if (currentDocument && currentDocument.id === docId) {
          setCurrentDocument(prev => prev ? { ...prev, guideText: newGuideText } : null);
        }
      }
    } catch (e) {
      console.error("Failed to save guide to DB", e);
    }
  };


  const startAnalysis = async (inputText: string, isLink: boolean, batchCount: number = 0, existingSentences?: string[], existingFullText?: string) => {
    previousState.current = appState;
    setCurrentInput({ text: inputText, isLink, batchCount, parsedSentences: existingSentences, fullText: existingFullText });
    setAppState('analyzing');

    try {
      let sentences = existingSentences;
      let finalFullText = existingFullText;

      // 1. If we don't have parsed sentences, ask Gemini to parse the raw text first
      if (!sentences || sentences.length === 0) {
        if (isLink) {
          // 1a. Fetch the raw YouTube transcript from the backend
          const transRes = await fetch(`${API_BASE_URL}/api/fetch-transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: inputText })
          });

          if (!transRes.ok) {
            const err = await transRes.json();
            throw new Error(err.error || "Failed to fetch YouTube transcript");
          }

          const transData = await transRes.json();
          const rawText = transData.text;

          // 1b. Format paragraphs using Gemini
          try {
            const formatRes = await fetch(`${API_BASE_URL}/api/format-paragraphs`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: rawText })
            });
            if (formatRes.ok) {
              const formatData = await formatRes.json();
              finalFullText = formatData.formattedText;
            } else {
              finalFullText = rawText;
            }
          } catch (e) {
            finalFullText = rawText;
          }

          // Update state so the current session has the full text immediately
          setCurrentInput(prev => prev ? { ...prev, fullText: finalFullText } : null);

          // 1c. Parse the raw transcript text into clean sentences using Gemini
          const parseRes = await fetch(`${API_BASE_URL}/api/parse-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: rawText })
          });

          if (!parseRes.ok) {
            const err = await parseRes.json();
            throw new Error(err.error || "Failed to parse video transcript into sentences");
          }

          const parseData = await parseRes.json();
          sentences = parseData.sentences;

        } else {
          // Format text paragraphs
          try {
            const formatRes = await fetch(`${API_BASE_URL}/api/format-paragraphs`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: inputText })
            });
            if (formatRes.ok) {
              const formatData = await formatRes.json();
              finalFullText = formatData.formattedText;
            } else {
              finalFullText = inputText;
            }
          } catch (e) {
            finalFullText = inputText;
          }

          setCurrentInput(prev => prev ? { ...prev, fullText: finalFullText } : null);

          const parseRes = await fetch(`${API_BASE_URL}/api/parse-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: inputText })
          });

          if (!parseRes.ok) {
            const err = await parseRes.json();
            throw new Error(err.error || "Failed to parse text");
          }

          const parseData = await parseRes.json();
          sentences = parseData.sentences;
        }
      }

      // If we have sentences but no fullText (e.g. from an old history item), format it now!
      if (!finalFullText && sentences && sentences.length > 0) {
        const fallbackText = sentences.join(" ");
        try {
          const formatRes = await fetch(`${API_BASE_URL}/api/format-paragraphs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: fallbackText })
          });
          if (formatRes.ok) {
            const formatData = await formatRes.json();
            finalFullText = formatData.formattedText;
          } else {
            finalFullText = fallbackText;
          }
        } catch (e) {
          finalFullText = fallbackText;
        }
        setCurrentInput(prev => prev ? { ...prev, fullText: finalFullText } : null);
      }

      if (!sentences || sentences.length === 0) {
        throw new Error("No sentences could be parsed from the text.");
      }

      // 2. Figure out the batch slice
      const startIndex = batchCount * 5;
      if (startIndex >= sentences.length) {
        // Reset learning state
        alert("🎉 이 텍스트의 모든 문장을 학습하셨습니다! 처음부터 다시 시작합니다.");
        startAnalysis(inputText, isLink, 0, sentences, finalFullText);
        return;
      }

      const batchSentences = sentences.slice(startIndex, startIndex + 5);
      const hasMore = sentences.length > startIndex + 5;

      // Update input history (Save to DB, then update State)
      if (user) {
        try {
          const { data: inserted, error: insErr } = await supabase.from('input_history').insert({
            user_id: user.id,
            text: inputText,
            is_link: isLink,
            batch_count: batchCount,
            parsed_sentences: sentences,
            full_text: finalFullText
          }).select().single();

          if (!insErr && inserted) {
            setInputHistory(prev => {
              const newHistory = [{
                id: inserted.id,
                text: inserted.text,
                isLink: inserted.is_link,
                batchCount: inserted.batch_count,
                parsedSentences: inserted.parsed_sentences,
                fullText: inserted.full_text,
                date: inserted.created_at
              }, ...prev.filter(i => i.text !== inputText)].slice(0, 5);
              return newHistory;
            });
          }
        } catch (e) {
          console.error("Input history save failed", e);
        }
      }

      // 3. Call Real Analyze Backend
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentences: batchSentences, isLink })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server error');
      }

      const data = await response.json();
      data.hasMore = hasMore; // Pass frontend calculation
      handleAnalysisComplete(data);
    } catch (error: any) {
      console.error("API Call failed:", error);
      alert("분석 중 오류가 발생했습니다: " + error.message);
      setAppState('input');
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
      const { data: inserted, error } = await supabase.from('review_list').insert({
        user_id: user.id,
        title: title,
        analysis_data: data
      }).select().single();

      if (!error && inserted) {
        const newItem: HistoryItem = {
          id: inserted.id,
          title: inserted.title,
          date: inserted.created_at,
          data: inserted.analysis_data
        };
        setHistory(prev => [newItem, ...prev]);

        // Reward the user with points for completing an analysis!
        updateBrainSyncScore(15);
      }
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

      const { data: saveRes, error } = await supabase.from('aha_moments').insert({
        user_id: user.id,
        original_phrase: ahaModalInfo.phrase,
        preposition: ahaModalInfo.preposition,
        user_note: userNote,
        ai_conversation: [
          { role: 'user', content: contextPayload }
        ]
      }).select().single();

      if (error) throw error;

      setAhaCount(prev => prev + 1);

      if (saveRes && saveRes.ai_conversation) {
        // Trigger AI feedback in the background
        fetch('/api/chat-aha-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation: saveRes.ai_conversation })
        }).then(res => res.json()).then(async (apiRes) => {
          if (apiRes.reply) {
            const finalConversation = [...saveRes.ai_conversation, { role: 'model', content: apiRes.reply }];
            await supabase.from('aha_moments').update({ ai_conversation: finalConversation }).eq('id', saveRes.id);
          }
        }).catch(err => console.error("AI Feedback error:", err));
      }

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
      {appState !== 'analyzing' && user && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', padding: '16px 24px 0', zIndex: 10 }}>
          <button
            onClick={() => setAppState('document_list')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: appState === 'document_list' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <Library size={24} className={appState === 'document_list' ? "text-blue-500 fill-blue-100" : ""} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>내 원문</span>
          </button>
          <button
            onClick={() => setAppState('review_list')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: appState === 'review_list' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <BookOpen size={24} className={appState === 'review_list' ? "text-blue-500 fill-blue-100" : ""} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>복습장</span>
          </button>
          <button
            onClick={() => setAppState('aha_collection')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: appState === 'aha_collection' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <Lightbulb size={24} className={appState === 'aha_collection' ? "text-amber-500 fill-amber-100" : ""} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>아하!</span>
          </button>
          <button
            onClick={() => setAppState('dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: appState === 'dashboard' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <LayoutDashboard size={24} className={appState === 'dashboard' ? "text-blue-500 fill-blue-100" : ""} />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>대시보드</span>
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
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
            onStart={startAnalysis}
            onCancel={handleCancelAnalysis}
            inputHistory={inputHistory}
            score={brainSyncScore}
            onScoreClick={() => setAppState('dashboard')}
          />
        </div>
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
          onBack={() => window.history.back()}
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
          onBack={() => window.history.back()}
          onDelete={async (docText) => {
            if (!user) return;
            try {
              const { error } = await supabase.from('input_history').delete().eq('user_id', user.id).eq('text', docText);
              if (!error) {
                setInputHistory(prev => prev.filter(item => item.text !== docText));
              } else {
                alert("삭제에 실패했습니다.");
              }
            } catch (e) { console.error(e); }
          }}
        />
      )}

      {appState === 'document_reader' && currentDocument && (
        <DocumentReaderScreen
          document={currentDocument}
          onBack={() => {
            window.history.back();
            setTimeout(() => setCurrentDocument(null), 100);
          }}
          onSaveGuide={handleSaveSpeakingGuide}
        />
      )}

      {appState === 'aha_collection' && user && (
        <AhaCollectionScreen
          user={user}
          onBack={() => window.history.back()}
          onCountChange={(count) => setAhaCount(count)}
        />
      )}

      {appState === 'dashboard' && user && (
        <DashboardScreen
          user={user}
          score={brainSyncScore}
          onBack={() => window.history.back()}
        />
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
