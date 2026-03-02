import { useState, useEffect } from 'react';
import { ArrowLeft, Trophy, Target, Lightbulb, Zap, Calendar, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { calculateLevelInfo } from '../lib/gameLogic';

interface Props {
    user: User;
    score: number;
    onBack: () => void;
}

export default function DashboardScreen({ user, score, onBack }: Props) {
    const [stats, setStats] = useState({
        totalSentences: 0,
        totalAhas: 0,
        lastStudyDate: '-',
        joinDate: '-'
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                // 1. Fetch total sentences from review_list
                const { data: reviews } = await supabase
                    .from('review_list')
                    .select('analysis_data')
                    .eq('user_id', user.id);

                let sentenceCount = 0;
                if (reviews) {
                    reviews.forEach(r => {
                        if (r.analysis_data?.word_order) {
                            sentenceCount += r.analysis_data.word_order.length;
                        }
                    });
                }

                // 2. Fetch total ahas
                const { count: ahaCount } = await supabase
                    .from('aha_moments')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id);

                // 3. Fetch join date and last activities
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('created_at, updated_at')
                    .eq('user_id', user.id)
                    .single();

                setStats({
                    totalSentences: sentenceCount,
                    totalAhas: ahaCount || 0,
                    lastStudyDate: profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString() : '-',
                    joinDate: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '-'
                });
            } catch (e) {
                console.error("Failed to fetch dashboard stats", e);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, [user.id, score]); // Re-fetch stats when score changes too (for reset)

    const { level: currentLevel, targetXP, progressPercentage } = calculateLevelInfo(score);

    return (
        <div style={{ padding: '24px', maxWidth: '100%', paddingBottom: '120px' }} className="animate-fade">
            {/* Header */}
            <header style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', marginLeft: '-8px' }}>
                    <ArrowLeft size={24} color="var(--primary)" />
                </button>
                <h2 style={{ fontSize: '20px', fontWeight: 700, marginLeft: '8px', margin: 0 }}>학습 통계 대시보드</h2>
            </header>

            {/* Level Card (Hero Section) */}
            <div style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                borderRadius: '24px',
                padding: '32px 24px',
                color: 'white',
                marginBottom: '24px',
                boxShadow: '0 20px 25px -5px rgba(59, 130, 246, 0.3)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <Trophy size={20} color="#fbbf24" fill="#fbbf24" />
                        <span style={{ fontSize: '14px', fontWeight: 600, opacity: 0.9 }}>NATIVE THINKING MASTER</span>
                    </div>
                    <h3 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 16px 0' }}>리드미컬 Lv.{currentLevel}</h3>

                    <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '14px', fontWeight: 500 }}>다음 레벨까지</span>
                        <span style={{ fontSize: '18px', fontWeight: 700 }}>{score} <span style={{ fontSize: '12px', opacity: 0.8 }}>/ {targetXP} XP</span></span>
                    </div>

                    <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.2)', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressPercentage}%`, height: '100%', background: 'white', transition: 'width 1.5s ease-out', borderRadius: '6px' }} />
                    </div>
                </div>

                {/* Decorative background circle */}
                <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', filter: 'blur(20px)' }} />
            </div>

            {/* Primary Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <StatCard
                    icon={<Target size={20} color="#3b82f6" />}
                    label="학습한 총 문장"
                    value={stats.totalSentences.toLocaleString()}
                    unit="문장"
                    loading={loading}
                />
                <StatCard
                    icon={<Lightbulb size={20} color="#f59e0b" />}
                    label="아하! 모먼트"
                    value={stats.totalAhas.toLocaleString()}
                    unit="개"
                    loading={loading}
                />
            </div>

            {/* Secondary Stats Card */}
            <div className="card" style={{ padding: '24px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={18} color="#4f46e5" />
                    활동 하이라이트
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <ActivityRow
                        icon={<Calendar size={18} color="#64748b" />}
                        label="가입일"
                        value={stats.joinDate}
                    />
                    <ActivityRow
                        icon={<Award size={18} color="#10b981" />}
                        label="마지막 학습"
                        value={stats.lastStudyDate}
                    />
                </div>
            </div>

            {/* Dopamine Motivational Message */}
            <div style={{ marginTop: '32px', textAlign: 'center', padding: '0 16px' }}>
                <p style={{ fontSize: '15px', color: '#475569', fontStyle: 'italic', lineHeight: 1.6 }}>
                    "꾸준함은 모든 것을 이깁니다. <br />
                    어순을 조립하는 즐거움을 잊지 마세요! 🧩"
                </p>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, unit, loading }: { icon: any, label: string, value: string, unit: string, loading: boolean }) {
    return (
        <div style={{ background: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <div style={{ marginBottom: '12px' }}>{icon}</div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b' }}>
                {loading ? '...' : value}
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginLeft: '4px' }}>{unit}</span>
            </div>
        </div>
    );
}

function ActivityRow({ icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {icon}
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#475569' }}>{label}</span>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{value}</span>
        </div>
    );
}
