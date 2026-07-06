# إرشادات الهوية البصرية لموقع جذع (Jidhe AI Guidelines)

هذا الملف مخصص لتوجيه نماذج الذكاء الاصطناعي (AI) عند توليد ملفات HTML مخصصة (مثل صفحات تحميل التطبيقات، المشاريع، أو المقالات التفاعلية) ليتم رفعها وإدراجها كإطار معزول (iframe) داخل موقع "جذع".

## 1. الفكرة العامة والروح
موقع "جذع" يتبنى هوية بصرية تعتمد على **الطبيعة، الأشجار، الجذور، الفصول، والورق القديم**.
يجب أن تعكس التصاميم جواً دافئاً، عتيقاً، وفي نفس الوقت عصرياً، يعبر عن "تأصل الأفكار ونموها كالأشجار".

## 2. الإعدادات الأساسية للملف (HTML Boilerplate)
بما أن الملف سيعمل كـ `iframe` معزول تماماً عن الموقع الأساسي، سيقوم النظام **تلقائياً** بتمرير جميع المكتبات الأساسية إليه (مثل خط ثمانية، مكتبة الأيقونات FontAwesome، ومكتبة الحركات AOS، ومكتبة التصميم الرئيسية).
**لذلك: لا تقم بتضمين أي روابط (CDN) لخطوط أو مكتبات خارجية في كود الـ HTML الذي تولده لتوفير مساحة وتقليل الحمل، اعتمد فقط على الأكواد الداخلية (Inline Styles) لعمل التنسيقات الإضافية التي تخص مقالتك فقط.**

الـ `iframe` تمت برمجته ليتمدد طولياً ليتناسب مع المحتوى، لذا **تجنب وضع سكرول (Scroll)** داخل عناصر الصفحة.

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>محتوى المقال</title>
    <!-- لا تقم بتضمين خط ثمانية أو FontAwesome هنا، النظام سيقوم بحقنها تلقائياً -->
    <style>
        /* التنسيقات الأساسية لتجنب ظهور هوامش أو خلفيات غير متناسقة في الـ iframe */
        body {
            margin: 0;
            padding: 15px;
            background: transparent; /* هام جداً للاندماج السلس */
            font-family: 'Thmanyah', Tahoma, Arial, sans-serif;
            color: #3E2723; /* Dark brown for text */
            line-height: 1.8;
            direction: rtl;
            overflow-x: hidden;
        }

        /* الألوان الأساسية */
        :root {
            --primary: #8C5A35;
            --primary-hover: #6c4222;
            --secondary: #D4A373;
            --accent: #E9EDC9;
            --accent-dark: #A3B18A;
            --card-bg: rgba(254, 250, 224, 0.6);
            --border-color: #D4A373;
        }

        /* تنسيق العناوين */
        h1, h2, h3 { color: var(--primary); font-weight: 900; }

        /* تنسيق الأزرار */
        .download-btn {
            display: inline-block; background-color: var(--primary);
            color: #fff; padding: 12px 25px; border-radius: 8px;
            text-decoration: none; font-weight: bold;
            border: 2px solid var(--primary); transition: all 0.3s ease;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .download-btn:hover {
            background-color: transparent; color: var(--primary); transform: translateY(-2px);
        }

        /* بطاقات العرض */
        .feature-card {
            background: var(--card-bg); border: 1px solid var(--border-color);
            border-radius: 15px; padding: 20px; margin-bottom: 20px;
            backdrop-filter: blur(10px);
        }
    </style>
</head>
<body>
    <!-- المحتوى يوضع هنا، استخدم أيقونات FontAwesome بحرية، فهي مضمنة مسبقاً (مثال: <i class="fas fa-download"></i>) -->
</body>
</html>
```

## 3. الألوان والهوية (Colors & Identity)
- **Primary (`#8C5A35`)**: لون رئيسي يعبر عن الجذع والخشب القوي. يُستخدم للعناوين والأزرار.
- **Secondary (`#D4A373`)**: لون الخشب الفاتح للحدود.
- **Accent (`#A3B18A`)**: لون ورقي مريح للانتباه.
- **Text (`#3E2723`)**: النص الرئيسي (بني داكن).

## 4. إرشادات تحسين محركات البحث (SEO Guidelines)
لضمان تصدر الموقع والمقالة في محركات البحث، يجب مراعاة التالي بصرامة عند توليد الكود:
1. **الترتيب الهرمي للعناوين (Heading Hierarchy):** يجب أن تحتوي الصفحة على `<h1>` واحد فقط يعبر عن الموضوع الرئيسي. ثم استخدام `<h2>` للعناوين الفرعية، و `<h3>` لما يتفرع منها.
2. **الوسوم الدلالية (Semantic HTML):** استخدم وسوم مثل `<article>`, `<section>`, `<header>`, `<main>`, `<figure>` لتوضيح بنية المحتوى لمحركات البحث.
3. **وصف الصور (Alt Text):** أي صورة تقوم بإدراجها يجب أن تحتوي على خاصية `alt` بوصف دقيق ومختصر للمحتوى باللغة العربية.
4. **تجنب التكرار:** اجعل المحتوى غنياً بالكلمات المفتاحية الطبيعية بدون حشو زائد.

## 5. ملاحظات أخيرة للـ AI
1. **الاندماج السلس:** اجعل خلفية الـ `body` دائماً `transparent`.
2. **عدم استدعاء المكتبات:** أكرر، لا تقم بوضع `link` لـ FontAwesome أو AOS، النظام سيضعها.
3. **الابتكار:** أضف أنيميشن CSS لبعض الأزرار أو البطاقات لتعطي حيوية للتصميم.
