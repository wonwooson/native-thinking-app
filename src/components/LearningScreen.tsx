import { useState, useRef, useEffect } from 'react';
import type { UIEvent } from 'react';
import type { AnalysisData } from '../types';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import QuizCard from './QuizCard';

interface Props {
    data: AnalysisData;
    onBack: () => void;
    onNextBatch: () => void;
}

export default function LearningScreen({ data, onBack, onNextBatch }: Props) {
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState<number | 'auto'>('auto');

    // Dynamically adjust the height of the swipe container based on the active slide
    // This prevents the bottom whitespace issue without breaking swipe physics
    useEffect(() => {
        const updateHeight = () => {
            const slide = document.getElementById(`slide-${activeIndex}`);
            if (slide) {
                // adding 24px to account for the container's paddingBottom
                setContainerHeight(slide.offsetHeight + 24);
            }
        };
        // Use a short timeout to let the DOM paint first
        const timer = setTimeout(updateHeight, 50);
        return () => clearTimeout(timer);
    }, [activeIndex, data]);

    // Build scalable dynamic sections array 
    const sections = [];
    if (data.word_order && data.word_order.length > 0) sections.push({ id: 'word_order', title: '어순', content: data.word_order });
    if (data.phrasal_verbs && data.phrasal_verbs.length > 0) sections.push({ id: 'phrasal_verbs', title: '구동사', content: data.phrasal_verbs });
    if (data.tricky_prepositions && data.tricky_prepositions.length > 0) sections.push({ id: 'prepositions', title: '전치사', content: data.tricky_prepositions });

    const handleScroll = (e: UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        const scrollPosition = target.scrollLeft;
        const width = target.clientWidth;
        // Calculate which section is currently holding the majority of the view
        const newIndex = Math.round(scrollPosition / width);
        if (newIndex !== activeIndex) {
            setActiveIndex(newIndex);
        }
    };

    const scrollToSection = (index: number) => {
        setActiveIndex(index);
        if (scrollContainerRef.current) {
            const width = scrollContainerRef.current.clientWidth;
            scrollContainerRef.current.scrollTo({
                left: width * index,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="animate-fade" style={{ paddingTop: '24px' }}>
            <header style={{ padding: '0 24px', display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                    <ArrowLeft size={24} color="var(--text-main)" />
                </button>
                <h2 style={{ fontSize: '18px', marginLeft: '8px', margin: 0 }}>오늘의 복습</h2>
            </header>

            {/* Scalable Tab Header - Scrollable horizontally if many tabs */}
            <div style={{ display: 'flex', padding: '0 24px', gap: '16px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px', overflowX: 'auto', whiteSpace: 'nowrap', msOverflowStyle: 'none', scrollbarWidth: 'none' }} className="hide-scrollbar">
                {sections.map((sec, idx) => (
                    <TabButton
                        key={sec.id}
                        title={sec.title}
                        isActive={activeIndex === idx}
                        onClick={() => scrollToSection(idx)}
                    />
                ))}
            </div>

            {/* Horizontal Swipe Carousel Container */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                style={{
                    display: 'flex',
                    alignItems: 'flex-start', /* Fixes white-space issue by not forcing equal height slides */
                    overflowX: 'auto',
                    overflowY: 'hidden', /* Hide the overflow from the inactive slides vertically */
                    scrollSnapType: 'x mandatory',
                    msOverflowStyle: 'none',
                    scrollbarWidth: 'none',
                    width: '100%',
                    paddingBottom: '24px',
                    height: containerHeight !== 'auto' ? `${containerHeight}px` : 'auto',
                    transition: 'height 0.3s ease-out'
                }}
                className="hide-scrollbar"
            >
                {sections.map((section, idx) => (
                    <div
                        id={`slide-${idx}`}
                        key={section.id}
                        style={{
                            flex: '0 0 100%',
                            width: '100%',
                            scrollSnapAlign: 'start',
                            scrollSnapStop: 'always',
                            padding: '0 24px'
                        }}
                    >
                        {section.id === 'word_order' && (
                            <div className="card animate-fade">
                                <h3 style={{ fontSize: '20px', marginBottom: '16px', color: 'var(--primary)' }}>어순 뜯어보기</h3>
                                {data.word_order.map((item, idx) => (
                                    <div key={idx} id={`sentence-card-${idx}`} style={{ marginBottom: '24px' }}>
                                        <p style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>"{item.original}"</p>

                                        <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}>
                                            <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>원어민의 사고 흐름</p>
                                            <p>{item.thinking_flow_ko}</p>
                                        </div>

                                        <div style={{ background: 'var(--danger-bg)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                                            <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--danger)', marginBottom: '4px' }}>주의! 한국인이 자주 하는 실수</p>
                                            <p style={{ fontSize: '15px' }}>{item.kr_typical_mistake}</p>
                                        </div>

                                        {item.quiz && (
                                            <div style={{ marginTop: '24px' }}>
                                                <QuizCard
                                                    type="multiple_choice"
                                                    question={item.quiz.question}
                                                    options={item.quiz.options}
                                                    correctAnswer={item.quiz.answer}
                                                    feedbackKo={item.quiz.feedbackKo}
                                                    onComplete={() => {
                                                        const nextEl = document.getElementById(`sentence-card-${idx + 1}`);
                                                        if (nextEl) {
                                                            nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                        }
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {section.id === 'phrasal_verbs' && (
                            <div className="card animate-fade">
                                <h3 style={{ fontSize: '20px', marginBottom: '16px', color: 'var(--primary)' }}>구동사 뉘앙스</h3>
                                {data.phrasal_verbs.map((item, idx) => (
                                    <div key={idx} style={{ marginBottom: '32px', borderBottom: idx !== data.phrasal_verbs.length - 1 ? '1px solid var(--border-color)' : 'none', paddingBottom: idx !== data.phrasal_verbs.length - 1 ? '24px' : '0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '13px', fontWeight: 700 }}>핵심 표현</span>
                                            <h4 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>{item.expression}</h4>
                                        </div>

                                        <p style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '12px' }}>
                                            <strong>기본 의미:</strong> {item.base_meaning_ko}
                                            <br />
                                            <strong>여기서의 의미:</strong> <span style={{ color: 'var(--primary)' }}>{item.context_meaning_ko}</span>
                                        </p>

                                        <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}>
                                            <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>비슷한 표현과 비교해볼까요?</p>
                                            {item.similar_expressions.map((sim: any, i: number) => (
                                                <div key={i} style={{ marginBottom: i !== item.similar_expressions.length - 1 ? '8px' : '0' }}>
                                                    <span style={{ fontWeight: 600 }}>{sim.expression}</span>: {sim.difference_ko}
                                                </div>
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
                                        <h4 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px', color: 'var(--primary)' }}>{item.expression}</h4>

                                        <div style={{ marginBottom: '16px' }}>
                                            <p style={{ fontSize: '15px', color: 'var(--success)', fontWeight: 600, marginBottom: '4px' }}>👍 자연스러운 표현</p>
                                            <p style={{ fontSize: '16px', background: 'var(--success-bg)', padding: '12px', borderRadius: '8px' }}>{item.correct_usage_example}</p>
                                        </div>

                                        <div style={{ marginBottom: '16px' }}>
                                            <p style={{ fontSize: '15px', color: 'var(--danger)', fontWeight: 600, marginBottom: '4px' }}>🚫 어색한 표현</p>
                                            <p style={{ fontSize: '16px', background: 'var(--danger-bg)', padding: '12px', borderRadius: '8px', textDecoration: 'line-through', opacity: 0.8 }}>{item.wrong_usage_example}</p>
                                            <p style={{ fontSize: '14px', color: 'var(--danger)', marginTop: '8px', paddingLeft: '8px', borderLeft: '2px solid var(--danger)' }}>
                                                <strong>원어민의 반응:</strong> {item.native_reaction_ko}
                                            </p>
                                        </div>

                                        <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                                            <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>💡 기억력 쏙쏙 스토리</p>
                                            <p style={{ fontSize: '15px', lineHeight: 1.6 }}>{item.story_ko}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Next Batch Button - Pinned at bottom of content area so it bridges all slides */}
            {data.hasMore && (
                <div style={{ marginTop: '16px', paddingBottom: '40px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '12px' }}>아직 남은 내용이 있다면 이어서 학습해보세요!</p>
                    <button
                        onClick={onNextBatch}
                        className="btn btn-secondary"
                        style={{ width: 'auto', padding: '12px 24px', border: '2px solid var(--primary-light)', color: 'var(--primary)' }}
                    >
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
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                paddingBottom: '8px'
            }}
        >
            {title}
        </button>
    );
}
