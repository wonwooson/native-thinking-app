import { ArrowLeft, FileText, Link as LinkIcon, Clock, Trash2 } from 'lucide-react';
import type { InputHistoryItem, DocumentItem } from '../types';

interface Props {
    inputHistory: InputHistoryItem[];
    onSelect: (doc: DocumentItem) => void;
    onBack: () => void;
    onDelete: (docText: string) => Promise<void>;
}

export default function DocumentListScreen({ inputHistory, onSelect, onBack, onDelete }: Props) {
    // Deduplicate history by the original text or link
    const uniqueDocs = inputHistory.reduce((acc, current) => {
        const x = acc.find(item => item.text === current.text);
        if (!x) {
            acc.push(current);
        }
        return acc;
    }, [] as InputHistoryItem[]);

    return (
        <div style={{ padding: '24px', maxWidth: '100%' }} className="animate-fade">
            <header style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                <button
                    onClick={onBack}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', color: 'var(--text-main)' }}
                >
                    <ArrowLeft size={24} />
                </button>
                <h2 style={{ fontSize: '18px', marginLeft: '8px', margin: 0 }}>내 원문 보관함</h2>
            </header>

            {uniqueDocs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                    <p>아직 저장된 원문이 없습니다.</p>
                    <p style={{ fontSize: '14px', marginTop: '8px' }}>유튜브 주소나 자막을 분석하면 이곳에 전체 텍스트가 저장됩니다.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {uniqueDocs.map(doc => {
                        const fullText = doc.fullText || ((doc.parsedSentences && doc.parsedSentences.length > 0)
                            ? doc.parsedSentences.join(" ")
                            : doc.text);

                        return (
                            <div key={doc.id} style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                                <button
                                    onClick={() => onSelect({
                                        id: doc.id,
                                        title: doc.isLink ? doc.text : `${fullText.substring(0, 30)}...`,
                                        fullText: fullText,
                                        date: doc.date,
                                        guideText: doc.guideText
                                    })}
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        background: 'var(--card-bg)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: '20px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '16px',
                                        transition: 'all 0.2s',
                                        boxShadow: 'var(--shadow-sm)'
                                    }}
                                >
                                    <div style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }}>
                                        {doc.isLink ? <LinkIcon size={20} /> : <FileText size={20} />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 8px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {doc.isLink ? doc.text : `${fullText.substring(0, 40)}...`}
                                        </h3>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} />
                                            {new Date(doc.date).toLocaleDateString()}
                                        </p>
                                    </div>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm("이 원문을 보관함에서 영구 삭제하시겠습니까?")) {
                                            if (onDelete) onDelete(doc.text);
                                        }
                                    }}
                                    style={{
                                        background: 'none',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-lg)',
                                        cursor: 'pointer',
                                        color: 'var(--danger)',
                                        padding: '0 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
