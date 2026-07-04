import { useState, useEffect, useMemo } from 'react';
import { Clock, CheckCircle2, XCircle, ChevronsLeft, ChevronsRight, Plus, Minus } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

export interface TranscriptItem {
    text: string;
    start: number;
    duration: number;
}

interface Props {
    items: TranscriptItem[];
    onConfirm: (selectedText: string) => void;
    onCancel: () => void;
}

function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function TimelineSelector({ items, onConfirm, onCancel }: Props) {
    const [startIdx, setStartIdx] = useState(0);
    const [endIdx, setEndIdx] = useState(Math.min(items.length - 1, 50)); // default to first ~50 lines if huge

    const maxIdx = items.length - 1;

    // Ensure valid range (rc-slider handles this mostly, but good to keep)
    useEffect(() => {
        if (startIdx > endIdx) {
            setEndIdx(startIdx);
        }
    }, [startIdx, endIdx]);

    const handleRangeChange = (value: number | number[]) => {
        if (Array.isArray(value)) {
            setStartIdx(value[0]);
            setEndIdx(value[1]);
        }
    };

    const shiftWindow = (direction: 'left' | 'right') => {
        const windowSize = endIdx - startIdx;
        if (direction === 'left') {
            const newStart = Math.max(0, startIdx - windowSize);
            setStartIdx(newStart);
            setEndIdx(newStart + windowSize);
        } else {
            const newEnd = Math.min(maxIdx, endIdx + windowSize);
            setEndIdx(newEnd);
            setStartIdx(newEnd - windowSize);
        }
    };

    const setPreset = (minutes: number) => {
        const targetDuration = minutes * 60;
        const startTime = items[startIdx].start;
        let newEndIdx = startIdx;
        for (let i = startIdx; i <= maxIdx; i++) {
            if (items[i].start - startTime >= targetDuration) {
                break;
            }
            newEndIdx = i;
        }
        setEndIdx(newEndIdx);
    };

    const adjustStart = (delta: number) => {
        setStartIdx(prev => Math.min(endIdx, Math.max(0, prev + delta)));
    };

    const adjustEnd = (delta: number) => {
        setEndIdx(prev => Math.max(startIdx, Math.min(maxIdx, prev + delta)));
    };

    const selectedText = useMemo(() => {
        return items.slice(startIdx, endIdx + 1).map(i => i.text).join(' ');
    }, [items, startIdx, endIdx]);

    const totalDuration = items.length > 0 ? items[items.length - 1].start + items[items.length - 1].duration : 0;

    return (
        <div className="animate-fade" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '16px' }}>
                <h2 style={{ fontSize: '24px', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Clock size={24} color="var(--primary)" /> 학습할 구간 선택
                </h2>
                <p style={{ color: 'var(--text-muted)' }}>
                    전체 길이: {formatTime(totalDuration)} ({items.length}개 블록)
                </p>
            </div>

            {/* Presets */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '14px', background: '#e0e7ff', color: 'var(--primary)', border: 'none' }} onClick={() => setPreset(1)}>1분 프리셋</button>
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '14px', background: '#e0e7ff', color: 'var(--primary)', border: 'none' }} onClick={() => setPreset(3)}>3분 프리셋</button>
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '14px', background: '#e0e7ff', color: 'var(--primary)', border: 'none' }} onClick={() => setPreset(5)}>5분 프리셋</button>
            </div>

            <div className="card" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 600, color: 'var(--text-main)', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>시작 시간: {items[startIdx] ? formatTime(items[startIdx].start) : '00:00'}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => adjustStart(-1)} style={{ padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', cursor: 'pointer' }} title="-1 블록"><Minus size={14} /></button>
                            <button onClick={() => adjustStart(1)} style={{ padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', cursor: 'pointer' }} title="+1 블록"><Plus size={14} /></button>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => adjustEnd(-1)} style={{ padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', cursor: 'pointer' }} title="-1 블록"><Minus size={14} /></button>
                            <button onClick={() => adjustEnd(1)} style={{ padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', cursor: 'pointer' }} title="+1 블록"><Plus size={14} /></button>
                        </div>
                        <span>종료 시간: {items[endIdx] ? formatTime(items[endIdx].start + items[endIdx].duration) : '00:00'}</span>
                    </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button 
                        onClick={() => shiftWindow('left')} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px' }}
                        title="이전 구간으로 점프"
                    >
                        <ChevronsLeft size={32} />
                    </button>
                    
                    <div style={{ flex: 1, padding: '0 10px' }}>
                        <Slider 
                            range={{ draggableTrack: true }}
                            min={0} 
                            max={maxIdx} 
                            value={[startIdx, endIdx]} 
                            onChange={handleRangeChange}
                            allowCross={false}
                            trackStyle={[{ backgroundColor: 'var(--primary)', height: 8, cursor: 'grab' }]}
                            handleStyle={[
                                { borderColor: 'var(--primary)', height: 20, width: 20, marginTop: -6, backgroundColor: 'var(--primary)', cursor: 'grab' },
                                { borderColor: 'var(--primary)', height: 20, width: 20, marginTop: -6, backgroundColor: 'var(--primary)', cursor: 'grab' }
                            ]}
                            railStyle={{ backgroundColor: '#e2e8f0', height: 8 }}
                        />
                    </div>

                    <button 
                        onClick={() => shiftWindow('right')} 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px' }}
                        title="다음 구간으로 점프"
                    >
                        <ChevronsRight size={32} />
                    </button>
                </div>
            </div>

            {/* Preview Box */}
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px' }}>미리보기 (총 {selectedText.split(/\s+/).length}단어)</h3>
                <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '15px', lineHeight: '1.6', color: 'var(--text-main)' }}>
                    {items.slice(startIdx, endIdx + 1).map((item, idx) => (
                        <span key={idx} style={{ marginRight: '4px' }}>
                            {item.text}
                        </span>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                    className="btn btn-secondary" 
                    onClick={onCancel}
                    style={{ flex: 1, padding: '14px', border: '2px solid #e2e8f0', color: 'var(--text-muted)', background: '#fff' }}
                >
                    <XCircle size={20} /> 취소
                </button>
                <button 
                    className="btn btn-primary" 
                    onClick={() => onConfirm(selectedText)}
                    style={{ flex: 2, padding: '14px' }}
                >
                    <CheckCircle2 size={20} /> 이 구간 학습 시작
                </button>
            </div>
        </div>
    );
}
