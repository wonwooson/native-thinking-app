import type { HistoryItem } from '../types';
import { Clock, ArrowLeft, BookOpen, Trash2 } from 'lucide-react';

interface Props {
    history: HistoryItem[];
    onSelect: (item: HistoryItem) => void;
    onBack: () => void;
    onClear: () => Promise<void>;
}

export default function ReviewList({ history, onSelect, onBack, onClear }: Props) {
    return (
        <div className="animate-fade" style={{ paddingTop: '24px' }}>
            <header style={{ padding: '0 24px', display: 'flex', alignItems: 'center', marginBottom: '16px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', marginLeft: '-8px' }}>
                        <ArrowLeft size={24} color="var(--text-main)" />
                    </button>
                    <h2 style={{ fontSize: '18px', marginLeft: '8px', margin: 0 }}>복습 노트</h2>
                </div>
                {history.length > 0 && (
                    <button onClick={onClear} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Trash2 size={14} /> 기록 지우기
                    </button>
                )}
            </header>

            <div style={{ padding: '0 24px 40px 24px' }}>
                {history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        <BookOpen size={48} opacity={0.3} style={{ margin: '0 auto 16px' }} />
                        <p style={{ fontSize: '16px', fontWeight: 500 }}>아직 복습할 기록이 없어요.</p>
                        <p style={{ fontSize: '14px', marginTop: '8px' }}>새로운 유튜브 영상이나 문장을<br /> 분석하고 학습을 시작해 보세요!</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {history.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onSelect(item)}
                                className="card"
                                style={{
                                    textAlign: 'left',
                                    border: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    display: 'block',
                                    width: '100%',
                                    padding: '20px'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0, paddingRight: '16px', lineHeight: 1.4 }}>
                                        {item.title.length > 30 ? item.title.substring(0, 30) + '...' : item.title}
                                    </h3>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                    <Clock size={12} />
                                    <span>{new Date(item.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
