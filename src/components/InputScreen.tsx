import { useState, useEffect } from 'react';
import { Type, Link as LinkIcon, Play, XCircle, Clock } from 'lucide-react';
import type { InputHistoryItem } from '../types';
import BrainSyncBar from './BrainSyncBar';

interface Props {
    isAnalyzing: boolean;
    onStart: (input: string, isLink: boolean, batchCount?: number, parsedSentences?: string[], existingFullText?: string) => void;
    onCancel: () => void;
    inputHistory: InputHistoryItem[];
    score: number;
    onScoreClick?: () => void;
}

export default function InputScreen({ isAnalyzing, onStart, onCancel, inputHistory, score, onScoreClick }: Props) {
    const [inputType, setInputType] = useState<'link' | 'text'>('link');
    const [inputValue, setInputValue] = useState('');
    const [progress, setProgress] = useState(0);
    const [loadingMessageIdx, setLoadingMessageIdx] = useState(0);

    const loadingMessages = [
        "AI 원어민 튜터가 문장을 꼼꼼히 읽고 있어요...",
        "한국인들이 자주 틀리는 포인트를 찾는 중 🔍",
        "구동사의 숨은 뉘앙스를 분석하고 있습니다 💡",
        "자연스러운 어순 흐름을 재구성하는 중 🧩",
        "거의 다 왔어요! 퀴즈를 준비하고 있습니다 📝"
    ];

    useEffect(() => {
        let timer: number;
        if (isAnalyzing) {
            setProgress(0);
            timer = window.setInterval(() => {
                setProgress(prev => {
                    // Start fast, but severely slow down as it approaches 99%
                    // This creates a much more pleasant "still working but taking time" UX
                    // Distance remaining to 99
                    const remaining = 99 - prev;
                    if (remaining > 50) {
                        return Math.min(99, prev + Math.floor(Math.random() * 15) + 5);
                    } else if (remaining > 20) {
                        return Math.min(99, prev + Math.floor(Math.random() * 5) + 2);
                    } else if (remaining > 5) {
                        return Math.min(99, prev + Math.floor(Math.random() * 3) + 1);
                    } else {
                        return Math.min(99, prev + (Math.random() > 0.7 ? 1 : 0));
                    }
                });
            }, 800); // 800ms ticks instead of 500ms
        }
        return () => clearInterval(timer);
    }, [isAnalyzing]);

    // Rotate loading messages
    useEffect(() => {
        let msgTimer: number;
        if (isAnalyzing) {
            msgTimer = window.setInterval(() => {
                setLoadingMessageIdx(prev => (prev + 1) % loadingMessages.length);
            }, 3000);
        } else {
            setLoadingMessageIdx(0);
        }
        return () => clearInterval(msgTimer);
    }, [isAnalyzing, loadingMessages.length]);

    return (
        <div style={{ padding: '24px', maxWidth: '100%' }} className="animate-fade">
            <div style={{ textAlign: 'center', marginBottom: '32px', marginTop: '48px' }}>
                <h1 style={{ fontSize: '32px', color: 'var(--primary)', marginBottom: '8px', fontWeight: 800 }}>Native Thinking</h1>
                <p style={{ color: 'var(--text-muted)' }}>방금 본 유튜브 표현, 내 것으로 만들기</p>
            </div>

            <BrainSyncBar score={score} onClick={onScoreClick} />

            <div className="card">
                {/* Toggle between Link and Text */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'var(--bg-color)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
                    <button
                        onClick={() => setInputType('link')}
                        style={{
                            flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none', background: inputType === 'link' ? 'white' : 'transparent',
                            fontWeight: 600, color: inputType === 'link' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s'
                        }}>
                        <LinkIcon size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                        유튜브 링크
                    </button>
                    <button
                        onClick={() => setInputType('text')}
                        style={{
                            flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none', background: inputType === 'text' ? 'white' : 'transparent',
                            fontWeight: 600, color: inputType === 'text' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s'
                        }}>
                        <Type size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                        자막 텍스트
                    </button>
                </div>

                {inputType === 'link' ? (
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>유튜브 영상 주소</label>
                        <input
                            type="text"
                            placeholder="https://youtube.com/watch?v=..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            disabled={isAnalyzing}
                            style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '15px' }}
                        />
                    </div>
                ) : (
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>자막 텍스트 붙여넣기</label>
                        <textarea
                            placeholder="분석할 영어 자막이나 문장을 넣어주세요..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            disabled={isAnalyzing}
                            rows={4}
                            style={{ width: '100%', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '15px', resize: 'vertical' }}
                        />
                    </div>
                )}

                {!isAnalyzing ? (
                    <>
                        <button
                            className="btn"
                            onClick={() => {
                                onStart(inputValue, inputType === 'link', 0);
                            }}
                            disabled={!inputValue.trim()}
                        >
                            <Play size={18} />
                            분석 시작하기
                        </button>

                        {inputHistory.length > 0 && (
                            <div style={{ marginTop: '32px' }}>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>최근 입력한 항목</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {inputHistory.slice(0, 5).map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                setInputValue(item.text);
                                                setInputType(item.isLink ? 'link' : 'text');
                                                onStart(item.text, item.isLink, item.batchCount + 1, item.parsedSentences, item.fullText);
                                            }}
                                            style={{
                                                background: 'var(--bg-color)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-sm)',
                                                padding: '12px',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontSize: '14px',
                                                transition: 'all 0.2s',
                                                color: 'var(--text-main)',
                                                textDecoration: 'none'
                                            }}
                                        >
                                            <div style={{ color: 'var(--text-muted)' }}>
                                                {item.isLink ? <LinkIcon size={14} /> : <Type size={14} />}
                                            </div>
                                            <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {item.text}
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={12} />
                                                <span>방금 전</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ marginTop: '24px', textAlign: 'center' }}>
                        <div style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600 }}>
                            <span style={{ color: 'var(--primary)', transition: 'opacity 0.3s' }}>{loadingMessages[loadingMessageIdx]}</span>
                        </div>
                        <div style={{ width: '100%', height: '24px', background: 'var(--primary-light)', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px', position: 'relative' }}>
                            <div style={{
                                width: `${progress}%`,
                                height: '100%',
                                background: 'var(--primary)',
                                transition: 'width 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                paddingRight: progress > 10 ? '12px' : '0'
                            }}>
                                {progress > 10 && (
                                    <span style={{ color: 'white', fontSize: '12px', fontWeight: 700 }}>
                                        {progress}%
                                    </span>
                                )}
                            </div>
                        </div>
                        <button className="btn btn-secondary" onClick={onCancel} style={{ color: 'var(--danger)', borderColor: 'var(--danger-bg)' }}>
                            <XCircle size={18} />
                            시간이 너무 길어지면 취소하기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
