import { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink, Volume2, Sparkles, Loader2 } from 'lucide-react';
import type { DocumentItem } from '../types';

interface Props {
    document: DocumentItem;
    onBack: () => void;
    onSaveGuide: (docId: string, newGuideText: string, originalFullText: string) => Promise<void>;
}

export default function DocumentReaderScreen({ document, onBack, onSaveGuide }: Props) {
    // If the title is a YouTube link, we show it explicitly
    const isYouTubeLink = document.title.includes('youtube.com') || document.title.includes('youtu.be');

    const [activeParagraph, setActiveParagraph] = useState<number | null>(null);
    const [isSpeakingMode, setIsSpeakingMode] = useState(false);
    const [guideText, setGuideText] = useState<string | null>(null);
    const [isLoadingGuide, setIsLoadingGuide] = useState(false);

    // Stop speaking when component unmounts
    useEffect(() => {
        return () => {
            window.speechSynthesis.cancel();
        };
    }, []);

    const speakParagraph = (text: string, index: number) => {
        window.speechSynthesis.cancel(); // Stop current

        // If clicking the currently active one, we just stop it
        if (activeParagraph === index) {
            setActiveParagraph(null);
            return;
        }

        // Strip slashes and asterisks for TTS
        const cleanTextForSpeech = text.replace(/\//g, '').replace(/\*/g, '').replace(/#/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech);
        utterance.lang = 'en-US';
        utterance.rate = 0.9; // Slightly slower for clear learning

        utterance.onend = () => {
            setActiveParagraph(null);
        };

        setActiveParagraph(index);
        window.speechSynthesis.speak(utterance);
    };

    const toggleSpeakingMode = async () => {
        if (isSpeakingMode) {
            setIsSpeakingMode(false);
            window.speechSynthesis.cancel();
            setActiveParagraph(null);
            return;
        }

        setIsSpeakingMode(true);
        window.speechSynthesis.cancel();
        setActiveParagraph(null);

        // 1. Use cached data if we already generated it previously!
        if (document.guideText) {
            setGuideText(document.guideText);
            return;
        }

        // 2. Otherwise, fetch it from the backend
        if (!guideText) {
            setIsLoadingGuide(true);
            try {
                // Use a relative path so it works perfectly across localhost and mobile IPs
                const API_URL = '/api/generate-speaking-guide';

                const res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: document.fullText })
                });

                if (res.ok) {
                    const data = await res.json();
                    setGuideText(data.guideText);
                    // Pass it back up to App.tsx to save in Supabase permanently!
                    onSaveGuide(document.id, data.guideText, document.fullText);
                } else {
                    alert("가이드를 생성하는데 실패했습니다.");
                    setIsSpeakingMode(false);
                }
            } catch (e) {
                console.error(e);
                alert("서버 연결에 실패했습니다.");
                setIsSpeakingMode(false);
            } finally {
                setIsLoadingGuide(false);
            }
        }
    };

    // Helper to render bold markers natively
    const renderSpeakingText = (text: string) => {
        // Split by **
        const parts = text.split(/\*\*(.*?)\*\*/g);
        return parts.map((part, i) => {
            if (i % 2 === 1) { // It was inside **
                return <strong key={i} style={{ color: 'var(--primary)', fontWeight: 800 }}>{part}</strong>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    const paragraphs = (isSpeakingMode && guideText)
        ? guideText.split('\n\n')
        : document.fullText.split('\n\n');

    return (
        <div style={{ padding: '0', maxWidth: '100%', minHeight: '100vh', background: 'var(--card-bg)', display: 'flex', flexDirection: 'column' }} className="animate-fade">
            {/* Sticky Top Header */}
            <header style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <button
                    onClick={onBack}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', color: 'var(--text-main)', marginLeft: '-8px' }}
                >
                    <ArrowLeft size={24} />
                </button>
                <div style={{ marginLeft: '12px', flex: 1, overflow: 'hidden' }}>
                    <h2 style={{ fontSize: '16px', margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {isSpeakingMode ? '스피킹 연습 모드' : '원문 읽기'}
                    </h2>
                </div>
                <button
                    onClick={toggleSpeakingMode}
                    style={{
                        background: isSpeakingMode ? 'var(--primary)' : 'var(--bg-color)',
                        color: isSpeakingMode ? '#fff' : 'var(--text-main)',
                        border: `1px solid ${isSpeakingMode ? 'var(--primary)' : 'var(--border-color)'}`,
                        borderRadius: '100px',
                        padding: '6px 12px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                    }}
                >
                    <Sparkles size={14} />
                    {isSpeakingMode ? '연습 모드 ON' : '스피킹 가이드'}
                </button>
            </header>

            {/* Document Content */}
            <div style={{ padding: '32px 24px', flex: 1 }}>
                {isYouTubeLink && (
                    <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <a href={document.title} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', fontSize: '14px', background: 'var(--primary-light)', padding: '6px 12px', borderRadius: '100px' }}>
                            <ExternalLink size={14} />
                            유튜브 원본 영상 보기
                        </a>
                    </div>
                )}

                {isLoadingGuide ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        <div style={{ padding: '40px 20px 20px', textAlign: 'center', color: 'var(--text-muted)' }} className="animate-fade">
                            <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 16px', color: 'var(--primary)' }} />
                            <h3 style={{ fontSize: '18px', margin: '0 0 12px 0', color: 'var(--text-main)', fontWeight: 700 }}>AI 스피킹 가이드 생성 중...</h3>
                            <p style={{ fontSize: '15px', margin: '0 0 8px 0', lineHeight: 1.5 }}>원어민의 자연스러운 끊어 읽기와 강세를<br />문맥에 맞게 분석하고 있습니다.</p>
                            <p style={{ fontSize: '13px', margin: 0, opacity: 0.7 }}>글의 길이에 따라 10~20초 정도 소요될 수 있습니다.<br />(최초 1회만 분석하며, 이후에는 즉시 불러옵니다)</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', opacity: 0.6 }}>
                            {/* Shimmering Skeleton Paragraphs */}
                            {[1, 2, 3].map(i => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div className="animate-shimmer" style={{ height: '20px', width: '100%', borderRadius: '4px' }}></div>
                                    <div className="animate-shimmer" style={{ height: '20px', width: '85%', borderRadius: '4px' }}></div>
                                    <div className="animate-shimmer" style={{ height: '20px', width: '60%', borderRadius: '4px' }}></div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{
                        fontSize: '18px',
                        lineHeight: '1.8',
                        color: 'var(--text-main)',
                        fontFamily: isSpeakingMode ? 'sans-serif' : 'serif',
                        letterSpacing: '-0.2px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px'
                    }}>
                        {paragraphs.map((p, idx) => {
                            if (!p.trim()) return null;
                            const isActive = activeParagraph === idx;
                            return (
                                <p
                                    key={idx}
                                    onClick={() => speakParagraph(p, idx)}
                                    style={{
                                        margin: 0,
                                        padding: '12px',
                                        borderRadius: 'var(--radius-lg)',
                                        background: isActive ? 'var(--primary-light)' : 'transparent',
                                        border: `1px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        position: 'relative',
                                        boxShadow: isActive ? '0 4px 12px rgba(var(--primary-rgb), 0.1)' : 'none'
                                    }}
                                >
                                    {isActive && (
                                        <span style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--primary)', color: '#fff', borderRadius: '50%', padding: '6px', display: 'flex', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                                            <Volume2 size={14} />
                                        </span>
                                    )}
                                    {isSpeakingMode ? renderSpeakingText(p) : p}
                                </p>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
