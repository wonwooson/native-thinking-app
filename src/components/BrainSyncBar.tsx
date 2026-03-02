import { Brain } from 'lucide-react';
import { calculateLevelInfo } from '../lib/gameLogic';

interface Props {
    score: number;
    onClick?: () => void;
}

export default function BrainSyncBar({ score, onClick }: Props) {
    const { level: currentLevel, targetXP, progressPercentage } = calculateLevelInfo(score);

    return (
        <div
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '24px',
                padding: '8px 16px', background: 'var(--bg-color)', borderRadius: '20px', fontSize: '13px',
                color: 'var(--text-muted)', cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s',
                border: '1px solid transparent'
            }}
            className={onClick ? "hover:border-indigo-200 hover:shadow-sm" : ""}
        >
            <Brain size={14} className="text-indigo-500" />
            <span style={{ fontWeight: 600 }}>Native Brain Sync Lv.{currentLevel}</span>
            <div style={{ width: '60px', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden', margin: '0 2px', flexShrink: 0 }}>
                <div style={{ height: '100%', background: 'linear-gradient(to right, #3b82f6, #4f46e5)', width: `${progressPercentage}%`, transition: 'width 1s ease-out' }} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 500 }}>{score}/{targetXP} XP</span>
        </div>
    );
}
