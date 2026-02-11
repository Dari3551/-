# نشر ChatKick أونلاين بسرعة (بدون تعديل كود)

لا أستطيع رفع المشروع لك على الإنترنت مباشرة من داخل هذه الدردشة، لكن هذا الملف يجعل النشر سريع جدًا:
ترفع المشروع إلى GitHub ثم تختار منصة نشر.

## الخيار الأسرع: Render (Backend + Postgres)
1) ارفع المشروع إلى GitHub
2) Render → New → Blueprint → اختر الريبو
3) سيقرأ `render.yaml` وينشئ Backend + Postgres تلقائيًا

بعد النشر خذ رابط الـ Backend مثل:
https://chatkick-backend.onrender.com

## نشر الويب: Vercel / Netlify
- Root Directory: `apps/web`
- ضع Environment Variable:
  - VITE_API_URL = https://YOUR_BACKEND_URL
- Deploy

## CORS
في Backend ضع:
CORS_ORIGIN = https://YOUR_WEB_URL

## OTP بالإيميل
- بدون SMTP: الكود يظهر في Logs
- للإرسال الفعلي: ضع SMTP_* في Environment Variables
