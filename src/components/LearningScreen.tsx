import { useState, useRef, useEffect } from 'react';
import type { UIEvent } from 'react';
import type { AnalysisData } from '../types';
import { Lightbulb, ArrowLeft, ArrowRight } from 'lucide-react';
import WordOrderGym from './WordOrderGym';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Props {
    data: AnalysisData;
    onBack: () => void;
    onNextBatch: () => void;
    user?: User | null;
    onScoreUpdate?: (amount: number, metadata: { combo: number, isDifficultyBonus: boolean }) => void;
    onAhaRequest?: (phrase: string, preposition: string, context?: string) => void;
}

export default function LearningScreen({ data, onBack, onNextBatch, user, onScoreUpdate, onAhaRequest }: Props) {
    const tabStorageKey = data.word_order?.[0]?.original ? `learning_tab_${data.word_order[0].original.substring(0, 30)}` : '';

    const [activeIndex, setActiveIndex] = useState(() => {
        if (!tabStorageKey) return 0;
        const saved = sessionStorage.getItem(tabStorageKey);
        return saved ? parseInt(saved, 10) : 0;
    });
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState<number | 'auto'>('auto');
    const [isChildDragging, setIsChildDragging] = useState(false);

    // Initial scroll restore
    useEffect(() => {
        if (activeIndex > 0 && scrollContainerRef.current) {
            const timer = setTimeout(() => {
                scrollToSection(activeIndex);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, []);

    // Persist tab index
    useEffect(() => {
        if (tabStorageKey) {
            sessionStorage.setItem(tabStorageKey, activeIndex.toString());
        }
    }, [activeIndex, tabStorageKey]);

    // Aha! Collection States
    const [savedAhas, setSavedAhas] = useState<{ original_phrase: string, level: number }[]>([]);

    useEffect(() => {
        const fetchAhas = async () => {
            if (!user) return;
            const { data: ahaData } = await supabase
                .from('aha_moments')
                .select('original_phrase, ai_conversation')
                .eq('user_id', user.id);
            if (ahaData) {
                const levels = ahaData.map(item => {
                    let level = 1;
                    const convLength = item.ai_conversation?.length || 0;
                    if (convLength >= 2) level = 2; // AI replied once
                    if (convLength > 2) level = 3; // Deep chat
                    return { original_phrase: item.original_phrase, level };
                });
                setSavedAhas(levels);
            }
        };
        fetchAhas();
    }, [user]);

    const getLightbulbStyle = (phrase: string) => {
        const match = savedAhas.find(a => a.original_phrase === phrase);
        const level = match ? match.level : 0;

        if (level === 0) return { color: '#9ca3af', fill: 'transparent', strokeWidth: 1.5 }; // Outline
        if (level === 1) return { color: '#fbbf24', fill: '#fef3c7', strokeWidth: 2 }; // Light yellow
        if (level === 2) return { color: '#f59e0b', fill: '#fcd34d', strokeWidth: 2 }; // Solid yellow
        return { color: '#d97706', fill: '#f59e0b', strokeWidth: 2, filter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.6))' }; // Glowing
    };

    useEffect(() => {
        const slide = document.getElementById(`slide-${activeIndex}`);
        if (!slide) return;

        // Dynamically track height changes within the slide
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setContainerHeight((entry.target as HTMLElement).offsetHeight + 24);
            }
        });

        resizeObserver.observe(slide);
        return () => resizeObserver.disconnect();
    }, [activeIndex, data]);

    const sections = [];
    if (data.word_order && data.word_order.length > 0) sections.push({ id: 'word_order', title: '어순', content: data.word_order });
    if (data.phrasal_verbs && data.phrasal_verbs.length > 0) sections.push({ id: 'phrasal_verbs', title: '구동사', content: data.phrasal_verbs });
    if (data.tricky_prepositions && data.tricky_prepositions.length > 0) sections.push({ id: 'prepositions', title: '전치사', content: data.tricky_prepositions });
    if (data.word_order && data.word_order.length > 0) sections.push({ id: 'quiz', title: '퀴즈', content: data.word_order });

    const handleScroll = (e: UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        const width = target.clientWidth;
        const newIndex = Math.round(target.scrollLeft / width);
        if (newIndex !== activeIndex) setActiveIndex(newIndex);
    };

    const scrollToSection = (index: number) => {
        setActiveIndex(index);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ left: scrollContainerRef.current.clientWidth * index, behavior: 'smooth' });
        }
    };

    return (
        <div className="animate-fade" style={{ paddingTop: '24px' }}>
            <header style={{ padding: '0 24px', display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', marginLeft: '-8px' }}>
                    <ArrowLeft size={24} color="var(--text-main)" />
                </button>
                <h2 style={{ fontSize: '18px', marginLeft: '8px', margin: 0 }}>오늘의 복습</h2>
            </header>

            <div style={{ display: 'flex', padding: '0 24px', gap: '16px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px', overflowX: 'auto', whiteSpace: 'nowrap', msOverflowStyle: 'none', scrollbarWidth: 'none' }} className="hide-scrollbar">
                {sections.map((sec, idx) => (
                    <TabButton key={sec.id} title={sec.title} isActive={activeIndex === idx} onClick={() => scrollToSection(idx)} />
                ))}
            </div>

            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                style={{
                    display: 'flex', alignItems: 'flex-start', overflowX: isChildDragging ? 'hidden' : 'auto', overflowY: 'hidden',
                    scrollSnapType: isChildDragging ? 'none' : 'x mandatory', msOverflowStyle: 'none', scrollbarWidth: 'none',
                    width: '100%', paddingBottom: '24px', height: containerHeight !== 'auto' ? `${containerHeight}px` : 'auto',
                    transition: 'height 0.3s ease-out'
                }}
                className="hide-scrollbar"
            >
                {sections.map((section, idx) => (
                    <div id={`slide-${idx}`} key={section.id} style={{ flex: '0 0 100%', width: '100%', scrollSnapAlign: 'start', scrollSnapStop: 'always', padding: '0 24px' }}>

                        {section.id === 'word_order' && (
                            <div className="card animate-fade">
                                <h3 style={{ fontSize: '20px', marginBottom: '16px', color: 'var(--primary)' }}>어순 뜯어보기</h3>
                                {data.word_order.map((item, idx) => (
                                    <div key={idx} id={`sentence-card-${idx}`} style={{ marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
                                            <p style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>"{item.original}"</p>
                                            <button
                                                onClick={() => {
                                                    const contextString = `[학습 맥락]\n원문: ${item.original}\n원어민 사고 흐름: ${item.thinking_flow_ko}\n한국인이 자주 하는 실수: ${item.kr_typical_mistake}`;
                                                    onAhaRequest?.(item.original, "어순", contextString);
                                                }}
                                                className="bg-amber-100/50 text-amber-600 hover:bg-amber-100 p-2 rounded-full transition-colors flex shrink-0"
                                            >
                                                <Lightbulb size={20} style={getLightbulbStyle(item.original)} />
                                            </button>
                                        </div>
                                        <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}>
                                            <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>원어민의 사고 흐름</p>
                                            <p>{item.thinking_flow_ko}</p>
                                        </div>
                                        <div style={{ background: 'var(--danger-bg)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                                            <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--danger)', marginBottom: '4px' }}>주의! 한국인이 자주 하는 실수</p>
                                            <p style={{ fontSize: '15px' }}>{item.kr_typical_mistake}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {section.id === 'phrasal_verbs' && (
                            <div className="card animate-fade">
                                <h3 style={{ fontSize: '20px', marginBottom: '16px', color: 'var(--primary)' }}>구동사 뉘앙스</h3>
                                {data.phrasal_verbs.map((item, idx) => (
                                    <div key={idx} style={{ marginBottom: '32px', borderBottom: idx !== data.phrasal_verbs.length - 1 ? '1px solid var(--border-color)' : 'none', paddingBottom: idx !== data.phrasal_verbs.length - 1 ? '24px' : '0' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '13px', fontWeight: 700 }}>핵심 표현</span>
                                                <h4 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>{item.expression}</h4>
                                            </div>
                                            <button
                                                onClick={() => onAhaRequest?.(item.expression, "구동사", `[학습 맥락]\n표현: ${item.expression}\n의미: ${item.context_meaning_ko}`)}
                                                className="bg-amber-100/50 text-amber-600 hover:bg-amber-100 p-2 rounded-full transition-colors flex shrink-0"
                                            >
                                                <Lightbulb size={20} style={getLightbulbStyle(item.expression)} />
                                            </button>
                                        </div>
                                        <p style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '12px' }}>
                                            <strong>기본 의미:</strong> {item.base_meaning_ko}<br />
                                            <strong>여기서의 의미:</strong> <span style={{ color: 'var(--primary)' }}>{item.context_meaning_ko}</span>
                                        </p>
                                        <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}>
                                            <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>비슷한 표현과 비교해볼까요?</p>
                                            {item.similar_expressions.map((sim: any, i: number) => (
                                                <div key={i} style={{ marginBottom: i !== item.similar_expressions.length - 1 ? '8px' : '0' }}><span style={{ fontWeight: 600 }}>{sim.expression}</span>: {sim.difference_ko}</div>
                                            ))}
                                        </div>
                                        <div style={{ background: 'var(--danger-bg)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                                            <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--danger)', marginBottom: '4px' }}>주의! 한국인이 자주 하는 실수</p>
                                            <p style={{ fontSize: '15px' }}>{item.common_mistake_ko}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {section.id === 'prepositions' && (
                            <div className="card animate-fade">
                                <h3 style={{ fontSize: '20px', marginBottom: '16px', color: 'var(--primary)' }}>오해를 부르는 전치사</h3>
                                {data.tricky_prepositions.map((item, idx) => (
                                    <div key={idx} style={{ marginBottom: '32px', borderBottom: idx !== data.tricky_prepositions.length - 1 ? '1px solid var(--border-color)' : 'none', paddingBottom: idx !== data.tricky_prepositions.length - 1 ? '24px' : '0' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '16px' }}>
                                            <h4 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: 'var(--primary)' }}>{item.expression}</h4>
                                            <button
                                                onClick={() => onAhaRequest?.(item.expression, "전치사", `[학습 맥락]\n전치사: ${item.expression}\n자연스러운 표현: ${item.correct_usage_example}`)}
                                                className="bg-amber-100/50 text-amber-600 hover:bg-amber-100 p-2 rounded-full transition-colors flex shrink-0"
                                            >
                                                <Lightbulb size={20} style={getLightbulbStyle(item.expression)} />
                                            </button>
                                        </div>
                                        <div style={{ marginBottom: '16px' }}>
                                            <p style={{ fontSize: '15px', color: 'var(--success)', fontWeight: 600, marginBottom: '4px' }}>👍 자연스러운 표현</p>
                                            <p style={{ fontSize: '16px', background: 'var(--success-bg)', padding: '12px', borderRadius: '8px' }}>{item.correct_usage_example}</p>
                                        </div>
                                        <div style={{ marginBottom: '16px' }}>
                                            <p style={{ fontSize: '15px', color: 'var(--danger)', fontWeight: 600, marginBottom: '4px' }}>🚫 어색한 표현</p>
                                            <p style={{ fontSize: '16px', background: 'var(--danger-bg)', padding: '12px', borderRadius: '8px', textDecoration: 'line-through', opacity: 0.8 }}>{item.wrong_usage_example}</p>
                                            <p style={{ fontSize: '14px', color: 'var(--danger)', marginTop: '8px', paddingLeft: '8px', borderLeft: '2px solid var(--danger)' }}><strong>원어민의 반응:</strong> {item.native_reaction_ko}</p>
                                        </div>
                                        <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                                            <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>💡 기억력 쏙쏙 스토리</p>
                                            <p style={{ fontSize: '15px', lineHeight: 1.6 }}>{item.story_ko}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {section.id === 'quiz' && (
                            <div className="card animate-fade">
                                <h3 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--primary)' }}>어순 조립 훈련소 🧩</h3>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>단어 블록을 드래그해서 원어민의 어순에 맞게 문장을 완성해 보세요!</p>
                                <WordOrderGym
                                    data={data.word_order}
                                    onComplete={onNextBatch}
                                    onDragStateChange={setIsChildDragging}
                                    onAhaRequest={(_wrongSeq, correctSeq, contextNote) => {
                                        onAhaRequest?.(correctSeq, "어순", contextNote);
                                    }}
                                    onScoreUpdate={onScoreUpdate}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {data.hasMore && (
                <div style={{ marginTop: '16px', paddingBottom: '40px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '12px' }}>아직 남은 내용이 있다면 이어서 학습해보세요!</p>
                    <button onClick={onNextBatch} className="btn btn-secondary" style={{ width: 'auto', padding: '12px 24px', border: '2px solid var(--primary-light)', color: 'var(--primary)' }}>
                        다음 5문장 분석하기 <ArrowRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}

function TabButton({ title, isActive, onClick }: { title: string, isActive: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '12px 16px', background: 'none', border: 'none', marginLeft: '-8px',
                borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500, fontSize: '16px', cursor: 'pointer', transition: 'all 0.2s', paddingBottom: '8px'
            }}
        >
            {title}
        </button>
    );
}
