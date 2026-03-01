import { useState } from 'react';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

interface QuizCardProps {
    type: 'multiple_choice' | 'sorting';
    question: string;
    options?: string[]; // For multiple choice
    correctAnswer: string;
    feedbackKo: string;
    onComplete: () => void;
}

export default function QuizCard({ type, question, options, correctAnswer, feedbackKo, onComplete }: QuizCardProps) {
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

    const handleSelect = (option: string) => {
        if (isCorrect !== null) return; // Prevent changing answer after submission
        setSelectedAnswer(option);

        const correct = option === correctAnswer;
        setIsCorrect(correct);
    };

    return (
        <div className="card animate-fade" style={{ marginTop: '24px', border: '2px solid var(--primary-light)' }}>
            <h4 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: 'var(--primary)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' }}>Mini Quiz</span>
                {question}
            </h4>

            {type === 'multiple_choice' && options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {options.map((option, idx) => {
                        let bgColor = 'var(--bg-color)';
                        let borderColor = 'var(--border-color)';
                        let color = 'var(--text-main)';

                        if (selectedAnswer === option) {
                            if (isCorrect) {
                                bgColor = 'var(--success-bg)';
                                borderColor = 'var(--success)';
                                color = 'var(--success)';
                            } else {
                                bgColor = 'var(--danger-bg)';
                                borderColor = 'var(--danger)';
                                color = 'var(--danger)';
                            }
                        } else if (selectedAnswer !== null && option === correctAnswer) {
                            // Show correct answer even if they got it wrong
                            bgColor = 'var(--success-bg)';
                            borderColor = 'var(--success)';
                            color = 'var(--success)';
                        }

                        return (
                            <button
                                key={idx}
                                onClick={() => handleSelect(option)}
                                disabled={isCorrect !== null}
                                style={{
                                    padding: '16px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: bgColor,
                                    border: `1px solid ${borderColor}`,
                                    color: color,
                                    fontSize: '16px',
                                    fontWeight: 500,
                                    textAlign: 'left',
                                    cursor: isCorrect === null ? 'pointer' : 'default',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                {option}
                                {selectedAnswer === option && isCorrect && <CheckCircle2 size={20} />}
                                {selectedAnswer === option && !isCorrect && <XCircle size={20} />}
                            </button>
                        );
                    })}
                </div>
            )}

            {isCorrect !== null && (
                <div className="animate-fade" style={{ background: isCorrect ? 'var(--success-bg)' : 'var(--danger-bg)', padding: '16px', borderRadius: 'var(--radius-sm)', marginTop: '16px' }}>
                    <p style={{ fontWeight: 600, color: isCorrect ? 'var(--success)' : 'var(--danger)', marginBottom: '4px' }}>
                        {isCorrect ? '정답이에요! 🎉' : '앗, 아쉬워요! 😊'}
                    </p>
                    <p style={{ fontSize: '15px', lineHeight: 1.5 }}>
                        {feedbackKo}
                    </p>
                    <button
                        onClick={onComplete}
                        className="btn"
                        style={{ marginTop: '16px', width: 'auto', padding: '10px 20px' }}
                    >
                        다음으로 넘어가기 <ArrowRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}
