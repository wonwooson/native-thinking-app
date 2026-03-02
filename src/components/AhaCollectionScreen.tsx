import { useState, useEffect } from 'react';
import { ArrowLeft, Lightbulb, Trash2, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface AhaMoment {
    id: string;
    original_phrase: string;
    preposition: string;
    user_note: string;
    ai_conversation?: { role: string, content: string }[];
    created_at: string;
}

interface Props {
    user: User;
    onBack: () => void;
    onCountChange?: (newCount: number) => void;
}

export default function AhaCollectionScreen({ user, onBack, onCountChange }: Props) {
    const [moments, setMoments] = useState<AhaMoment[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
    const [isReplying, setIsReplying] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetchMoments();
    }, []);

    const fetchMoments = async () => {
        try {
            const { data, error } = await supabase
                .from('aha_moments')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMoments(data || []);
        } catch (e) {
            console.error("Failed to fetch aha moments", e);
        } finally {
            setLoading(false);
        }
    };

    const deleteMoment = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("이 아하! 모먼트를 지우시겠어요?")) return;

        try {
            const { error } = await supabase.from('aha_moments').delete().eq('id', id);
            if (!error) {
                const newMoments = moments.filter(m => m.id !== id);
                setMoments(newMoments);
                onCountChange?.(newMoments.length);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleRetryFirstChat = async (momentId: string, currentConversation: any[]) => {
        if (!currentConversation || currentConversation.length === 0) return;

        setIsReplying(prev => ({ ...prev, [momentId]: true }));
        try {
            const res = await fetch('/api/chat-aha-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversation: currentConversation })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Chat failed');

            const finalConversation = [...currentConversation, { role: 'model', content: data.reply }];
            await supabase.from('aha_moments').update({ ai_conversation: finalConversation }).eq('id', momentId);
            setMoments(prev => prev.map(m => m.id === momentId ? { ...m, ai_conversation: finalConversation } : m));

        } catch (e) {
            console.error(e);
            alert('AI 답변 요청에 실패했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setIsReplying(prev => ({ ...prev, [momentId]: false }));
        }
    };

    const handleSendChat = async (momentId: string, currentConversation: any[]) => {
        const newText = replyTexts[momentId]?.trim();
        if (!newText) return;

        setIsReplying(prev => ({ ...prev, [momentId]: true }));
        try {
            // Optimistic UX
            const updatedConversation = [...(currentConversation || []), { role: 'user', content: newText }];
            setMoments(prev => prev.map(m => m.id === momentId ? { ...m, ai_conversation: updatedConversation } : m));
            setReplyTexts(prev => ({ ...prev, [momentId]: '' }));

            const res = await fetch('/api/chat-aha-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversation: updatedConversation })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Chat failed');

            const finalConversation = [...updatedConversation, { role: 'model', content: data.reply }];
            await supabase.from('aha_moments').update({ ai_conversation: finalConversation }).eq('id', momentId);
            setMoments(prev => prev.map(m => m.id === momentId ? { ...m, ai_conversation: finalConversation } : m));

        } catch (e) {
            console.error(e);
            alert('메시지 전송에 실패했습니다.');
            fetchMoments(); // revert optimistic
        } finally {
            setIsReplying(prev => ({ ...prev, [momentId]: false }));
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '100%', paddingBottom: '128px' }} className="animate-fade">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', marginLeft: '-8px' }}>
                    <ArrowLeft size={24} color="var(--primary)" />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                    <Lightbulb size={24} fill="#fef3c7" color="#f59e0b" />
                    <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>나만의 아하! 콜렉션</h2>
                </div>
            </div>

            <p style={{ color: '#64748b', marginBottom: '32px', fontSize: '14px' }}>
                전치사와 구동사의 숨겨진 뉘앙스를 깨달았던 소중한 순간들을 모아두었습니다.
                단순 암기가 아닌, '느낌'으로 영어를 이해하기 시작한 증거입니다!
            </p>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '128px' }}>
                    <div style={{ color: '#94a3b8' }}>불러오는 중...</div>
                </div>
            ) : moments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 0', backgroundColor: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                    <Lightbulb size={48} style={{ margin: '0 auto 16px', color: '#cbd5e1' }} />
                    <h3 style={{ color: '#475569', fontWeight: 700, marginBottom: '8px' }}>아직 수집된 단서가 없습니다</h3>
                    <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                        학습 화면에서 '전치사'나 '구동사'를 보다가<br />
                        깨달음을 얻으면 전구(💡) 버튼을 눌러 기록해보세요!
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {moments.map((moment) => (
                        <div
                            key={moment.id}
                            style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', border: '1px solid #fef3c7', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', minHeight: '160px' }}
                        >
                            {/* Decorative top tape */}
                            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '64px', height: '16px', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}></div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', marginTop: '8px' }}>
                                <div style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {moment.preposition}
                                </div>
                                <button
                                    onClick={(e) => deleteMoment(moment.id, e)}
                                    style={{ color: '#cbd5e1', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: '9999px', padding: '4px', border: 'none', cursor: 'pointer' }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '16px', lineHeight: 1.375 }}>
                                "{(moment.original_phrase || '').toUpperCase()}"
                            </div>

                            <div style={{ marginTop: 'auto', backgroundColor: '#fffbeb', padding: '12px', borderRadius: '8px', border: '1px solid #fef3c7', position: 'relative' }}>
                                <Lightbulb size={14} style={{ position: 'absolute', top: '12px', left: '12px', color: '#f59e0b' }} />
                                <p style={{ fontSize: '14px', color: '#475569', paddingLeft: '24px', whiteSpace: 'pre-wrap', lineHeight: 1.625, margin: 0 }}>
                                    {moment.user_note || "깨달음의 순간!"}
                                </p>
                            </div>

                            {/* AI Chat Thread */}
                            {moment.ai_conversation && moment.ai_conversation.length > 0 && (
                                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {moment.ai_conversation.length === 1 && (
                                        <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: '16px 0', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                                            <p style={{ margin: '0 0 8px 0', fontStyle: 'italic' }}>AI 원어민 튜터가 아직 답변을 작성하지 않았거나 오류가 발생했습니다.</p>
                                            <button
                                                onClick={() => handleRetryFirstChat(moment.id, moment.ai_conversation || [])}
                                                disabled={isReplying[moment.id]}
                                                style={{ backgroundColor: 'transparent', color: '#2563eb', border: '1px solid #2563eb', borderRadius: '999px', padding: '6px 16px', fontSize: '12px', fontWeight: 600, cursor: isReplying[moment.id] ? 'wait' : 'pointer', opacity: isReplying[moment.id] ? 0.5 : 1 }}
                                            >
                                                {isReplying[moment.id] ? '답변을 생성 중입니다...' : '튜터 답변 다시 요청하기 ↺'}
                                            </button>
                                        </div>
                                    )}
                                    {moment.ai_conversation.slice(1).map((msg, i) => (
                                        <div key={i} style={{
                                            alignSelf: msg.role === 'model' ? 'flex-start' : 'flex-end',
                                            backgroundColor: msg.role === 'model' ? '#f1f5f9' : '#e0f2fe',
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            borderBottomLeftRadius: msg.role === 'model' ? 0 : '8px',
                                            borderBottomRightRadius: msg.role === 'model' ? '8px' : 0,
                                            maxWidth: '90%',
                                            fontSize: '13px',
                                            color: '#334155',
                                            whiteSpace: 'pre-wrap',
                                            border: msg.role === 'model' ? '1px solid #e2e8f0' : 'none'
                                        }}>
                                            {msg.role === 'model' && <div style={{ fontWeight: 700, fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>AI 튜터</div>}
                                            {msg.content}
                                        </div>
                                    ))}

                                    {/* Chat Input */}
                                    {moment.ai_conversation.length > 1 && (
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            <input
                                                type="text"
                                                placeholder="궁금한 걸 더 물어보세요..."
                                                value={replyTexts[moment.id] || ''}
                                                onChange={(e) => setReplyTexts(prev => ({ ...prev, [moment.id]: e.target.value }))}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSendChat(moment.id, moment.ai_conversation || []);
                                                }}
                                                style={{ flex: 1, padding: '8px 12px', fontSize: '13px', borderRadius: '999px', border: '1px solid #cbd5e1', outline: 'none' }}
                                                disabled={isReplying[moment.id]}
                                            />
                                            <button
                                                onClick={() => handleSendChat(moment.id, moment.ai_conversation || [])}
                                                disabled={isReplying[moment.id] || !replyTexts[moment.id]?.trim()}
                                                style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '999px', padding: '0 12px', fontSize: '12px', fontWeight: 700, cursor: isReplying[moment.id] ? 'wait' : 'pointer', opacity: (isReplying[moment.id] || !replyTexts[moment.id]?.trim()) ? 0.5 : 1 }}
                                            >
                                                전송
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '16px', fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>
                                <Calendar size={12} />
                                {new Date(moment.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
