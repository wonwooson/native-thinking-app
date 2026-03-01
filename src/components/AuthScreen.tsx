import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, UserPlus, LogIn } from 'lucide-react';

interface Props {
    onSuccess: () => void;
}

const AuthScreen: React.FC<Props> = ({ onSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMSG, setErrorMSG] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMSG(null);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                onSuccess();
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                alert('회원가입 성공! 이제 로그인해 주세요. (이메일 인증이 필요한 경우 이메일을 확인하세요)');
                setIsLogin(true);
            }
        } catch (error: any) {
            setErrorMSG(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '40px auto', padding: '24px', background: 'var(--bg-color)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-color)' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--text-main)', fontSize: '24px' }}>
                {isLogin ? '환영합니다 👋' : '새 계정 만들기 ✨'}
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
                학습 기록을 모든 기기에서 동기화하세요.
            </p>

            {errorMSG && (
                <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '14px', border: '1px solid var(--danger)' }}>
                    {errorMSG}
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

                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-main)' }}>비밀번호 (6자리 이상)</label>
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

                <button
                    type="submit"
                    disabled={loading || !email || !password || password.length < 6}
                    className="btn"
                    style={{ marginTop: '8px', opacity: loading ? 0.7 : 1 }}
                >
                    {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                    {loading ? '처리 중...' : (isLogin ? '로그인' : '회원가입')}
                </button>
            </form>

            <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)' }}>
                {isLogin ? "계정이 없으신가요? " : "이미 계정이 있으신가요? "}
                <button
                    onClick={() => { setIsLogin(!isLogin); setErrorMSG(null); }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                    {isLogin ? '회원가입' : '로그인으로 돌아가기'}
                </button>
            </div>
        </div>
    );
};

export default AuthScreen;
