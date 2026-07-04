import type { AnalysisData } from '../types';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import WordOrderGym from './WordOrderGym';
import type { User } from 'firebase/auth';

interface Props {
    data: AnalysisData;
    onBack: () => void;
    onNextBatch: () => void;
    user?: User | null;
    onScoreUpdate?: (amount: number, metadata: { combo: number, isDifficultyBonus: boolean }) => void;
    onAhaRequest?: (phrase: string, preposition: string, context?: string) => void;
}

export default function LearningScreen({ data, onBack, onNextBatch, onScoreUpdate, onAhaRequest }: Props) {
    return (
        <div className="animate-fade" style={{ paddingTop: '24px', paddingBottom: '40px' }}>
            <header style={{ padding: '0 24px', display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', marginLeft: '-8px' }}>
                    <ArrowLeft size={24} color="var(--text-main)" />
                </button>
                <h2 style={{ fontSize: '18px', marginLeft: '8px', margin: 0 }}>꼬리물기 훈련소</h2>
            </header>

            <div style={{ padding: '0 24px' }}>
                <div className="card animate-fade">
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>원문을 덩어리 단위로 읽고, 한글만 보며 쉐도잉하고, 뉘앙스를 응용해 보세요!</p>
                    {data.word_order && data.word_order.length > 0 ? (
                        <WordOrderGym
                            data={data.word_order}
                            onScoreUpdate={onScoreUpdate}
                            onAhaRequest={onAhaRequest}
                        />
                    ) : (
                        <p>분석 데이터가 없습니다.</p>
                    )}
                </div>

                {data.hasMore ? (
                    <div style={{ marginTop: '24px', textAlign: 'center' }}>
                        <button onClick={onNextBatch} className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 700 }}>
                            다음 10문장 이어서 학습하기 <ArrowRight size={20} style={{ verticalAlign: 'middle', marginLeft: '8px' }} />
                        </button>
                    </div>
                ) : (
                    <div style={{ marginTop: '24px', textAlign: 'center' }}>
                        <button onClick={onBack} className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 700 }}>
                            🎉 전체 학습 완료 (홈으로 가기)
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
