import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, UserPlus, LogIn } from 'lucide-react';

interface Props {
    onSuccess: () => void;
}

const AuthScreen: React.FC<Props> = ({ onSuccess }) => {
    const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error_msg, setErrorMsg] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null);

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                onSuccess();
            } else if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                alert('회원가입 성공! 이제 로그인해 주세요. (이메일 인증이 필요한 경우 이메일을 확인하세요)');
                setMode('login');
            } else if (mode === 'reset') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin,
                });
                if (error) throw error;
                alert('비밀번호 재설정 이메일을 보냈습니다! 이메일을 확인해 주세요.');
                setMode('login');
            }
        } catch (error: any) {
            console.error('Auth Error:', error);
            if (error.message === 'Failed to fetch') {
                setErrorMsg('네트워크 오류가 발생했습니다. Supabase 설정(URL/KEY) 또는 인터넷 연결을 확인해주세요.');
            } else {
                setErrorMsg(error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '40px auto', padding: '24px', background: 'var(--bg-color)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-color)' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--text-main)', fontSize: '24px' }}>
                {mode === 'login' ? '환영합니다 👋' : mode === 'signup' ? '새 계정 만들기 ✨' : '비밀번호 재설정 🔑'}
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
                {mode === 'reset' ? '가입하신 이메일로 재설정 링크를 보내드립니다.' : '학습 기록을 모든 기기에서 동기화하세요.'}
            </p>

            {error_msg && (
                <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '14px', border: '1px solid var(--danger)' }}>
                    {error_msg}
                </div>
            )}

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-main)' }}>이메일</label>
                    <div style={{ position: 'relative' }}>
                        <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="hello@example.com"
                            required
                            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                        />
                    </div>
                </div>

                {mode !== 'reset' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)' }}>비밀번호 (6자리 이상)</label>
                            {mode === 'login' && (
                                <button
                                    type="button"
                                    onClick={() => { setMode('reset'); setErrorMsg(null); }}
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', padding: 0 }}
                                >
                                    비밀번호 분실?
                                </button>
                            )}
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                            />
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !email || (mode !== 'reset' && (!password || password.length < 6))}
                    className="btn"
                    style={{ marginTop: '8px', opacity: loading ? 0.7 : 1 }}
                >
                    {mode === 'login' ? <LogIn size={18} /> : mode === 'signup' ? <UserPlus size={18} /> : <Mail size={18} />}
                    {loading ? '처리 중...' : (mode === 'login' ? '로그인' : mode === 'signup' ? '회원가입' : '재설정 이메일 보내기')}
                </button>
            </form>

            <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)' }}>
                {mode === 'login' ? "계정이 없으신가요? " : mode === 'signup' ? "이미 계정이 있으신가요? " : "들어가고 싶으신가요? "}
                <button
                    onClick={() => {
                        if (mode === 'login') setMode('signup');
                        else setMode('login');
                        setErrorMsg(null);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                    {mode === 'login' ? '회원가입' : '로그인으로 돌아가기'}
                </button>
            </div>
        </div>
    );
};

export default AuthScreen;
