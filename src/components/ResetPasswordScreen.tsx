import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { updatePassword } from 'firebase/auth';
import { Lock, CheckCircle } from 'lucide-react';

interface Props {
    onComplete: () => void;
}

const ResetPasswordScreen: React.FC<Props> = ({ onComplete }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setErrorMsg('비밀번호가 일치하지 않습니다.');
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            setErrorMsg('로그인 상태가 아닙니다.');
            return;
        }

        setLoading(true);
        setErrorMsg(null);

        try {
            await updatePassword(user, password);
            alert('비밀번호가 성공적으로 변경되었습니다!');
            onComplete();
        } catch (error: any) {
            console.error('Password Update Error:', error);
            if (error.code === 'auth/weak-password') {
                setErrorMsg('비밀번호는 최소 6자리 이상이어야 합니다.');
            } else if (error.code === 'auth/requires-recent-login') {
                setErrorMsg('보안을 위해 다시 로그인한 후 비밀번호를 변경해 주세요.');
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
                새 비밀번호 설정 🔒
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
                새로운 비밀번호를 입력해 주세요.
            </p>

            {errorMsg && (
                <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '14px', border: '1px solid var(--danger)' }}>
                    {errorMsg}
                </div>
            )}

            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-main)' }}>새 비밀번호 (6자리 이상)</label>
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

                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-main)' }}>비밀번호 확인</label>
                    <div style={{ position: 'relative' }}>
                        <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || !password || password.length < 6 || password !== confirmPassword}
                    className="btn"
                    style={{ marginTop: '8px', opacity: loading ? 0.7 : 1 }}
                >
                    <CheckCircle size={18} />
                    {loading ? '변경 중...' : '비밀번호 변경하기'}
                </button>
            </form>
        </div>
    );
};

export default ResetPasswordScreen;
