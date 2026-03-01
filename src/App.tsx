import { useState, useEffect, useRef } from 'react';
import './index.css';
import InputScreen from './components/InputScreen';
import LearningScreen from './components/LearningScreen';
import ReviewList from './components/ReviewList';
import type { AppState, AnalysisData, HistoryItem, InputHistoryItem, DocumentItem } from './types';
import { BookOpen, LogOut, Library } from 'lucide-react';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';
import AuthScreen from './components/AuthScreen';
import DocumentListScreen from './components/DocumentListScreen';
import DocumentReaderScreen from './components/DocumentReaderScreen';

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

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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
      } catch (e) {
        console.error("Failed to load history from Supabase", e);
      }
    };

    loadData();
  }, [user]);

  const clearHistory = async () => {
    if (!user) return;
    try {
      await supabase.from('review_list').delete().eq('user_id', user.id);
      setHistory([]);
    } catch (e) {
      console.error(e);
    }
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
      }
    } catch (e) {
      console.error("Review list save failed", e);
    }
  };

  const handleCancelAnalysis = () => {
    setAppState(previousState.current);
  };

  const returnHome = () => {
    setAppState(previousState.current);
    setAnalysisData(null);
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
    <div className="app-container">
      {(appState === 'input' || appState === 'analyzing') && (
        <div style={{ position: 'relative' }}>
          {appState !== 'analyzing' && (
            <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', gap: '16px', zIndex: 10 }}>
              <button
                onClick={() => setAppState('review_list')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
              >
                <BookOpen size={24} />
                <span style={{ fontSize: '11px', fontWeight: 600 }}>복습장</span>
              </button>
              <button
                onClick={() => setAppState('document_list')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
              >
                <Library size={24} />
                <span style={{ fontSize: '11px', fontWeight: 600 }}>내 원문</span>
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
          <InputScreen
            isAnalyzing={appState === 'analyzing'}
            onStart={startAnalysis}
            onCancel={handleCancelAnalysis}
            inputHistory={inputHistory}
          />
        </div>
      )}

      {appState === 'learning' && analysisData && (
        <LearningScreen
          data={analysisData}
          onBack={returnHome}
          onNextBatch={handleNextBatch}
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
            setAppState(previousState.current === 'document_list' ? 'document_list' : 'input');
            setCurrentDocument(null);
          }}
          onSaveGuide={handleSaveSpeakingGuide}
        />
      )}
    </div>
  );
}

export default App;
