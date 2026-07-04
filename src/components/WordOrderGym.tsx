import { useState } from 'react';
import { Lightbulb, EyeOff, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';
import type { WordOrderPoint } from '../types';

interface Props {
    data: WordOrderPoint[];
    onScoreUpdate?: (amount: number, metadata: { combo: number, isDifficultyBonus: boolean }) => void;
    onAhaRequest?: (phrase: string, preposition: string, contextNote: string) => void;
}

type TabType = 'original' | 'shadowing' | 'twist';

export default function WordOrderGym({ data, onAhaRequest }: Props) {
    const [activeTab, setActiveTab] = useState<TabType>('original');
    const [savedAhas, setSavedAhas] = useState<Set<number>>(new Set());
    const [revealedShadowing, setRevealedShadowing] = useState<Set<string>>(new Set());
    const [revealedTwist, setRevealedTwist] = useState<Set<number>>(new Set());

    const handleSaveAha = (item: WordOrderPoint, index: number) => {
        if (!item.variation || savedAhas.has(index)) return;
        
        const phrase = item.original;
        const context = `[원문]\n${item.original}\n\n[뉘앙스 변조]\n${item.variation.type}: ${item.variation.new_block_text}\n${item.variation.nuance_ko}`;
        
        onAhaRequest?.(phrase, "뉘앙스 변조", context);
        setSavedAhas(prev => new Set(prev).add(index));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-color)', padding: '4px', borderRadius: '12px', gap: '4px' }}>
                <button 
                    onClick={() => setActiveTab('original')}
                    style={{ flex: 1, padding: '10px', border: 'none', background: activeTab === 'original' ? '#fff' : 'transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: activeTab === 'original' ? 700 : 500, color: activeTab === 'original' ? 'var(--primary)' : 'var(--text-muted)', boxShadow: activeTab === 'original' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                    <BookOpen size={16} /> 원문 읽기
                </button>
                <button 
                    onClick={() => setActiveTab('shadowing')}
                    style={{ flex: 1, padding: '10px', border: 'none', background: activeTab === 'shadowing' ? '#fff' : 'transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: activeTab === 'shadowing' ? 700 : 500, color: activeTab === 'shadowing' ? '#10b981' : 'var(--text-muted)', boxShadow: activeTab === 'shadowing' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                    <EyeOff size={16} /> 쉐도잉
                </button>
                <button 
                    onClick={() => setActiveTab('twist')}
                    style={{ flex: 1, padding: '10px', border: 'none', background: activeTab === 'twist' ? '#fff' : 'transparent', borderRadius: '8px', cursor: 'pointer', fontWeight: activeTab === 'twist' ? 700 : 500, color: activeTab === 'twist' ? '#f59e0b' : 'var(--text-muted)', boxShadow: activeTab === 'twist' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                    <Sparkles size={16} /> 응용
                </button>
            </div>

            {/* Content Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {data.map((item, idx) => {
                    if (activeTab === 'original') {
                        let tailCount = 0;
                        return (
                            <div key={idx} style={{ padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '16px', lineHeight: '1.6' }}>
                                {item.blocks.map((b, bIdx) => {
                                    if (b.type === 'core') {
                                        return <strong key={bIdx} style={{ color: 'var(--text-main)', marginRight: '6px', fontSize: '18px' }}>{b.text}</strong>;
                                    }
                                    tailCount++;
                                    let color = '#64748b'; // default gray
                                    if (tailCount === 1) color = '#3b82f6'; // blue
                                    else if (tailCount === 2) color = '#10b981'; // green
                                    
                                    return <span key={bIdx} style={{ color, marginRight: '6px', fontWeight: 500 }}>{b.text}</span>;
                                })}
                            </div>
                        );
                    }

                    if (activeTab === 'shadowing') {
                        return (
                            <div key={idx} style={{ padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #10b98120', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ fontSize: '13px', color: '#10b981', fontWeight: 700, marginBottom: '4px' }}>블라인드 모드 (클릭하여 원문 확인)</div>
                                {item.blocks.map((b, bIdx) => {
                                    const blockId = `${idx}-${bIdx}`;
                                    const isRevealed = revealedShadowing.has(blockId);
                                    
                                    // Calculate color for English text
                                    let color = '#64748b';
                                    if (b.type === 'core') color = 'var(--text-main)';
                                    else {
                                        let tailIndex = 0;
                                        for(let i=0; i<=bIdx; i++) {
                                            if (item.blocks[i].type !== 'core') tailIndex++;
                                        }
                                        if (tailIndex === 1) color = '#3b82f6';
                                        else if (tailIndex === 2) color = '#10b981';
                                    }

                                    return (
                                        <div 
                                            key={bIdx} 
                                            onClick={() => {
                                                setRevealedShadowing(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(blockId)) next.delete(blockId);
                                                    else next.add(blockId);
                                                    return next;
                                                });
                                            }}
                                            style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', cursor: 'pointer', padding: '6px', borderRadius: '6px', backgroundColor: isRevealed ? '#f8fafc' : 'transparent', transition: 'background-color 0.2s' }}
                                        >
                                            <span style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: b.type === 'core' ? 700 : 500 }}>
                                                {b.role}
                                            </span>
                                            <span style={{ color: '#cbd5e1', fontWeight: 300 }}>/</span>
                                            {isRevealed && (
                                                <span className="animate-fade" style={{ fontSize: '16px', color, fontWeight: b.type === 'core' ? 700 : 500, marginLeft: '4px' }}>
                                                    {b.text}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    }

                    if (activeTab === 'twist') {
                        if (!item.variation) return null;
                        const isSaved = savedAhas.has(idx);
                        const isRevealed = revealedTwist.has(idx);
                        
                        return (
                            <div key={idx} style={{ padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #f59e0b30', position: 'relative' }}>
                                <button 
                                    onClick={() => handleSaveAha(item, idx)}
                                    disabled={isSaved}
                                    style={{ position: 'absolute', top: '16px', right: '16px', background: isSaved ? '#fef3c7' : '#fff', border: '1px solid #fde68a', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isSaved ? 'default' : 'pointer', transition: 'all 0.2s', zIndex: 2 }}
                                >
                                    {isSaved ? <CheckCircle2 size={18} color="#d97706" /> : <Lightbulb size={18} color="#f59e0b" />}
                                </button>
                                
                                <div style={{ fontSize: '13px', color: '#d97706', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {item.variation.type}
                                    <button 
                                        onClick={() => {
                                            setRevealedTwist(prev => {
                                                const next = new Set(prev);
                                                if (next.has(idx)) next.delete(idx);
                                                else next.add(idx);
                                                return next;
                                            });
                                        }}
                                        style={{ background: '#fef3c7', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', color: '#b45309', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                        {isRevealed ? "응용 보기" : "원문 보기"}
                                    </button>
                                </div>
                                
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', paddingRight: '32px' }}>
                                    {item.blocks.map((b, bIdx) => {
                                        if (isRevealed) {
                                            // Original View
                                            let tailCount = 0;
                                            for(let i=0; i<=bIdx; i++) if (item.blocks[i].type !== 'core') tailCount++;
                                            let color = '#64748b';
                                            let bg = '#f8fafc';
                                            let border = '1px solid #cbd5e1';
                                            if (b.type === 'core') {
                                                color = 'var(--text-main)';
                                                bg = '#fff';
                                                border = '2px solid var(--text-main)';
                                            } else if (tailCount === 1) {
                                                color = '#3b82f6';
                                                border = '1px solid #93c5fd';
                                                bg = '#eff6ff';
                                            } else if (tailCount === 2) {
                                                color = '#10b981';
                                                border = '1px solid #6ee7b7';
                                                bg = '#ecfdf5';
                                            }

                                            return (
                                                <div key={bIdx} className="animate-fade" style={{ padding: '6px 12px', background: bg, border, borderRadius: '8px', color, fontWeight: b.type === 'core' ? 700 : 500 }}>
                                                    {b.text}
                                                </div>
                                            );
                                        } else {
                                            // Twist View
                                            const isTarget = bIdx === item.variation?.target_block_index;
                                            if (isTarget) {
                                                return (
                                                    <div key={bIdx} className="animate-fade" style={{ padding: '6px 12px', background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', fontWeight: 700, color: '#b45309' }}>
                                                        {item.variation?.new_block_text}
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div key={bIdx} className="animate-fade" style={{ padding: '6px 12px', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
                                                    {b.text}
                                                </div>
                                            );
                                        }
                                    })}
                                </div>
                                
                                <div style={{ padding: '12px', background: 'var(--bg-color)', borderRadius: '8px', fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                                    {item.variation.nuance_ko}
                                </div>
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
        </div>
    );
}
