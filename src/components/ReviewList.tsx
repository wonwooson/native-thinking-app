import type { HistoryItem } from '../types';
import { Clock, ArrowLeft, BookOpen, Trash2 } from 'lucide-react';

interface Props {
    history: HistoryItem[];
    onSelect: (item: HistoryItem) => void;
    onBack: () => void;
    onClear: () => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
}

export default function ReviewList({ history, onSelect, onBack, onClear, onDelete }: Props) {
    return (
        <div className="animate-fade" style={{ paddingTop: '24px' }}>
            <header style={{ padding: '0 24px', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', marginLeft: '-8px' }}>
                        <ArrowLeft size={24} color="var(--text-main)" />
                    </button>
                    <h2 style={{ fontSize: '18px', marginLeft: '8px', margin: 0 }}>복습 노트</h2>
                </div>
            </header>

            <div style={{ padding: '0 24px 40px 24px' }}>
                {history.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                        <button onClick={onClear} style={{ background: 'var(--danger-bg)', border: 'none', color: 'var(--danger)', fontSize: '14px', fontWeight: 500, padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Trash2 size={16} /> 전체 기록 삭제
                        </button>
                    </div>
                )}
                {history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        <BookOpen size={48} opacity={0.3} style={{ margin: '0 auto 16px' }} />
                        <p style={{ fontSize: '16px', fontWeight: 500 }}>아직 복습할 기록이 없어요.</p>
                        <p style={{ fontSize: '14px', marginTop: '8px' }}>새로운 유튜브 영상이나 문장을<br /> 분석하고 학습을 시작해 보세요!</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {history.map((item) => (
                            <div key={item.id} style={{ position: 'relative' }}>
                                <button
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
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', margin: 0, paddingRight: '40px', lineHeight: 1.4 }}>
                                            {item.title.length > 30 ? item.title.substring(0, 30) + '...' : item.title}
                                        </h3>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                        <Clock size={12} />
                                        <span>{new Date(item.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm("이 복습 기록을 삭제하시겠습니까? (XP가 차감됩니다)")) {
                                            onDelete?.(item.id);
                                        }
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: '16px',
                                        right: '16px',
                                        background: 'rgba(255,255,255,0.8)',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '50%',
                                        padding: '8px',
                                        cursor: 'pointer',
                                        color: '#94a3b8',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        zIndex: 1
                                    }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
