import { useState, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckCircle2, XCircle, RefreshCw, ArrowRight } from 'lucide-react';
import type { WordOrderPoint } from '../types';

// Helper to shuffle array safely
function shuffleArray<T>(array: T[]): T[] {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

// Draggable Item Component
function SortableItem(props: { id: string, text: string, status: 'idle' | 'correct' | 'wrong' }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: props.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.9 : 1,
        scale: isDragging ? "1.05" : "1",

        // Layout & Typography
        padding: '12px 16px',
        borderRadius: '12px',
        border: '2px solid',
        cursor: isDragging ? 'grabbing' : 'grab',
        fontWeight: 600,
        userSelect: 'none' as const,
        touchAction: 'none' as const, // Prevents mobile from scrolling the page when trying to drag the block
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',

        // Theme Colors
        borderColor: props.status === 'correct' ? '#4ade80' : props.status === 'wrong' ? '#f87171' : '#cbd5e1',
        backgroundColor: props.status === 'correct' ? '#f0fdf4' : props.status === 'wrong' ? '#fef2f2' : '#ffffff',
        color: props.status === 'correct' ? '#166534' : props.status === 'wrong' ? '#991b1b' : '#334155',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="word-block-draggable"
        >
            {props.text}
        </div>
    );
}

interface Props {
    data: WordOrderPoint[];
    onComplete: () => void;
    onDragStateChange?: (isDragging: boolean) => void;
    onAhaRequest?: (wrongSequence: string, correctSequence: string, contextNote: string) => void;
    onScoreUpdate?: (amount: number, metadata: { combo: number, isDifficultyBonus: boolean }) => void;
}

export default function WordOrderGym({ data, onComplete, onDragStateChange, onAhaRequest, onScoreUpdate }: Props) {
    const storageKey = data.length > 0 ? `word_order_gym_${data[0].original.substring(0, 30)}` : '';

    const [currentIndex, setCurrentIndex] = useState(() => {
        if (!storageKey) return 0;
        const saved = sessionStorage.getItem(`${storageKey}_index`);
        return saved ? parseInt(saved, 10) : 0;
    });
    const [chunks, setChunks] = useState<{ id: string, text: string }[]>([]);
    const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>(() => {
        if (!storageKey) return 'idle';
        const saved = sessionStorage.getItem(`${storageKey}_status_${currentIndex}`);
        return (saved as any) || 'idle';
    });
    const [comboCount, setComboCount] = useState(0);

    const currentItem = data[currentIndex];

    // Setup the next question chunks
    const setupQuestion = () => {
        if (!currentItem || !storageKey) return;

        // Try to load chunks from storage first
        const savedChunks = sessionStorage.getItem(`${storageKey}_chunks_${currentIndex}`);
        if (savedChunks) {
            setChunks(JSON.parse(savedChunks));
            return;
        }

        // Use the pre-analyzed meaningful chunks (blocks) from the AI
        if (currentItem.blocks && currentItem.blocks.length > 0) {
            // Map blocks to the format expected by the sorting UI
            const initialChunks = currentItem.blocks.map((b, i) => ({
                id: `chunk-${i}-${b.text.substring(0, 5)}`,
                text: b.text
            }));

            // Shuffle them
            let shuffled = shuffleArray(initialChunks);

            // Ensure it's not the same as original order if possible
            const originalText = currentItem.blocks.map(b => b.text).join(' ').toLowerCase();
            if (initialChunks.length > 1) {
                while (shuffled.map(s => s.text).join(' ').toLowerCase() === originalText) {
                    shuffled = shuffleArray(initialChunks);
                }
            }

            setChunks(shuffled);
            setStatus('idle');
            return;
        }

        // Fallback to word-level split if blocks are missing (legacy or error)
        const cleanSentence = currentItem.original.replace(/[.,!?]$/, "");
        const words = cleanSentence.split(' ');
        const initialChunks = words.map((w, i) => ({ id: `word-${i}`, text: w }));

        let shuffled = shuffleArray(initialChunks);
        if (words.length > 1) {
            while (shuffled.map(s => s.text).join(' ') === words.join(' ')) {
                shuffled = shuffleArray(initialChunks);
            }
        }

        setChunks(shuffled);
        setStatus('idle');
    };

    useEffect(() => {
        setupQuestion();
    }, [currentIndex, data]);

    // Persist changes to storage
    useEffect(() => {
        if (!storageKey) return;
        sessionStorage.setItem(`${storageKey}_index`, currentIndex.toString());
    }, [currentIndex, storageKey]);

    useEffect(() => {
        if (!storageKey || chunks.length === 0) return;
        sessionStorage.setItem(`${storageKey}_chunks_${currentIndex}`, JSON.stringify(chunks));
        sessionStorage.setItem(`${storageKey}_status_${currentIndex}`, status);
    }, [chunks, status, currentIndex, storageKey]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setChunks((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex) as { id: string, text: string }[];
            });
        }
    };
    const checkAnswer = () => {
        const originalText = currentItem.original.toLowerCase().replace(/[.,!?]$/, "").trim();
        const currentText = chunks.map(c => c.text).join(' ').toLowerCase().replace(/[.,!?]$/, "").trim();

        // Remove extra spaces if any (AI might put leading/trailing spaces in chunks)
        const normalizedOriginal = originalText.replace(/\s+/g, ' ');
        const normalizedCurrent = currentText.replace(/\s+/g, ' ');

        const isCorrect = normalizedOriginal === normalizedCurrent;

        if (isCorrect) {
            const newCombo = comboCount + 1;
            setComboCount(newCombo);

            // Calculate XP
            let baseXP = 10;
            let bonusXP = 0;

            // Difficulty Bonus: More than 4 chunks
            const isDifficultyBonus = currentItem.blocks && currentItem.blocks.length >= 5;
            if (isDifficultyBonus) bonusXP += 5;

            // Combo Bonus: 5 points per combo starting from 2
            if (newCombo >= 2) bonusXP += (newCombo - 1) * 5;

            onScoreUpdate?.(baseXP + bonusXP, { combo: newCombo, isDifficultyBonus });
            setStatus('correct');
        } else {
            setComboCount(0); // Reset combo on wrong answer
            setStatus('wrong');
        }
    };

    const handleNext = () => {
        if (currentIndex < data.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            onComplete(); // Batch completed
        }
    };

    const handleRetry = () => {
        setupQuestion();
    };

    if (!currentItem) return null;

    return (
        <div>
            <div style={{ marginBottom: '24px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
                <p style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>원어민의 사고 흐름에 따라 어순을 맞춰보세요</p>
                <p style={{ fontSize: '16px', color: '#334155', lineHeight: 1.5 }}>
                    {currentItem.thinking_flow_ko}
                </p>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={() => {
                    onDragStateChange?.(true);
                    if (status !== 'idle') setStatus('idle'); // Clear error/success state to allow re-trying
                }}
                onDragEnd={(event) => {
                    onDragStateChange?.(false);
                    handleDragEnd(event);
                }}
                onDragCancel={() => onDragStateChange?.(false)}
            >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '32px', minHeight: '100px', touchAction: 'none' }}>
                    <SortableContext items={chunks.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                        {chunks.map((chunk) => (
                            <SortableItem key={chunk.id} id={chunk.id} text={chunk.text} status={status} />
                        ))}
                    </SortableContext>
                </div>
            </DndContext>

            {status === 'idle' && (
                <button
                    onClick={checkAnswer}
                    className="btn btn-primary animate-fade"
                    style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 600, borderRadius: '12px' }}
                >
                    정답 확인하기
                </button>
            )}

            {status === 'correct' && (
                <div className="animate-fade" style={{ background: 'var(--success-bg)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                    <CheckCircle2 color="var(--success)" size={48} style={{ margin: '0 auto 12px' }} />
                    <h4 style={{ color: 'var(--success)', margin: '0 0 8px 0', fontSize: '18px' }}>
                        {comboCount >= 2 ? `🔥 ${comboCount} 콤보!!` : '완벽합니다! 🎉'}
                    </h4>
                    <p style={{ color: '#064e3b', marginBottom: '16px', fontSize: '15px' }}>
                        {comboCount >= 2 ? `연속 정답 가산점이 폭발하고 있어요!` : '원어민의 어순을 완벽하게 이해하셨네요!'}
                    </p>
                    <button
                        onClick={handleNext}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 600, borderRadius: '12px', backgroundColor: 'var(--success)' }}
                    >
                        {currentIndex < data.length - 1 ? '다음 문제' : '퀴즈 완료 및 다음 분석'} <ArrowRight size={20} style={{ marginLeft: '8px' }} />
                    </button>
                </div>
            )}

            {status === 'wrong' && (
                <div className="animate-fade" style={{ background: 'var(--danger-bg)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                    <XCircle color="var(--danger)" size={48} style={{ margin: '0 auto 12px' }} />
                    <h4 style={{ color: 'var(--danger)', margin: '0 0 8px 0', fontSize: '18px' }}>아쉽네요!</h4>
                    <p style={{ color: '#7f1d1d', marginBottom: '16px', fontSize: '15px' }}>다시 한 번 고민해보고 조립해볼까요?</p>

                    <button
                        onClick={handleRetry}
                        className="btn btn-secondary"
                        style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 600, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: onAhaRequest ? '12px' : '0' }}
                    >
                        <RefreshCw size={20} style={{ marginRight: '8px' }} /> 다시 시도하기
                    </button>

                    {onAhaRequest && (
                        <button
                            onClick={() => {
                                const correctSequence = currentItem.original.replace(/[.,!?]$/, "");
                                const wrongSequence = chunks.map(c => c.text).join(' ');
                                const contextNote = `[오답 분석 요청]\n💡 정답 어순: ${correctSequence}\n❌ 나의 어순: ${wrongSequence}\n\n제가 왜 이렇게 배열했는지, 혹은 이 어순이 왜 어색한지 AI 선생님이 설명해주세요!`;
                                onAhaRequest(wrongSequence, correctSequence, contextNote);
                            }}
                            style={{
                                width: '100%', padding: '16px', fontSize: '15px', fontWeight: 600, borderRadius: '12px',
                                backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                            }}
                        >
                            💡 내 오답 아하! 노트로 보내기
                        </button>
                    )}
                </div>
            )}

            <div style={{ marginTop: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>
                문제 {currentIndex + 1} / {data.length}
            </div>

            {/* Global style specifically injected for touch management */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .word-block-draggable {
                    touch-action: none !important;
                }
            `}} />
        </div>
    );
}
