import React from 'react';

export default class ErrorBoundary extends (React.Component as any) {
  constructor(props: any) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if ('fallback' in this.props) {
        return this.props.fallback;
      }

      let errorMessage = 'เกิดข้อผิดพลาดบางอย่าง';

      try {
        const parsedError = JSON.parse(this.state.error?.message || '');
        if (parsedError.error && parsedError.error.includes('Missing or insufficient permissions')) {
          errorMessage = 'คุณไม่มีสิทธิ์ดำเนินการนี้ กรุณาตรวจสอบว่าเข้าสู่ระบบด้วยบัญชีที่ได้รับอนุญาตแล้ว';
        }
      } catch (e) {
        // Not a JSON error, use default
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-brand-navy p-4">
          <div className="bg-white/5 border border-white/10 rounded-[40px] p-12 max-w-lg text-center">
            <h2 className="text-3xl font-black tracking-tighter mb-6 text-brand-neon">ระบบขัดข้อง</h2>
            <p className="text-white/60 mb-8 leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="neon-button mx-auto"
            >
              โหลดหน้าใหม่
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
