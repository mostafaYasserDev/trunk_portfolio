# إرشادات الهوية البصرية لموقع جذع (Jidhe AI Guidelines)

هذا الملف مخصص لتوجيه نماذج الذكاء الاصطناعي (AI) بصرامة عند توليد ملفات HTML مخصصة (مثل صفحات تحميل التطبيقات، المشاريع، أو المقالات التفاعلية) ليتم رفعها وإدراجها كإطار معزول (iframe) داخل موقع "جذع".

## 1. الفكرة العامة والروح
موقع "جذع" يتبنى هوية بصرية تعتمد على **الطبيعة، الأشجار، الجذور، الفصول، والورق القديم**.
يجب أن تعكس التصاميم جواً دافئاً، عتيقاً، وفي نفس الوقت عصرياً، يعبر عن "تأصل الأفكار ونموها كالأشجار". يجب أن تبدو الصفحات المضافة وكأنها جزء أصيل لا يتجزأ من الموقع.

## 2. الإعدادات الأساسية للملف (HTML Boilerplate)
سيقوم النظام **تلقائياً** بتمرير جميع المكتبات الأساسية للـ `iframe` (مثل خط "ثمانية"، مكتبة الأيقونات FontAwesome، ومكتبة الحركات AOS). 
**القاعدة الذهبية: لا تقم بتضمين أي روابط (CDN) لخطوط أو مكتبات خارجية في كود الـ HTML لتوفير مساحة وتقليل الحمل، اعتمد فقط على الأكواد الداخلية (Inline Styles / `<style>`) لعمل التنسيقات الإضافية التي تخص مقالتك فقط.**

الـ `iframe` يتمدد طولياً ليتناسب مع المحتوى، لذا **تجنب وضع سكرول (Scroll)** داخل عناصر الصفحة الرئيسية.

### هيكل الـ HTML الأساسي:
```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>محتوى المقال</title>
    <style>
        /* الألوان الأساسية للموقع */
        :root {
            --primary: #8C5A35;
            --primary-hover: #6c4222;
            --secondary: #D4A373;
            --accent: #E9EDC9;
            --accent-dark: #A3B18A;
            --card-bg: rgba(254, 250, 224, 0.6); /* أو #FEFAE0 صريح */
            --text-main: #3E2723;
            --text-muted: #6D4C41;
            --border-color: #D4A373;
        }

        body {
            margin: 0;
            padding: 15px;
            background: transparent; /* هام جداً للاندماج السلس مع الموقع الأب */
            font-family: 'Thmanyah', Tahoma, Arial, sans-serif;
            font-weight: 500;
            color: var(--text-main);
            line-height: 1.8;
            direction: rtl;
            overflow-x: hidden;
        }

        /* تنسيقات العناوين لتتطابق مع هوية جذع */
        h1, h2, h3, h4 { color: var(--primary); font-weight: 900; margin-top: 0; }
        h1 { font-size: 2.2rem; margin-bottom: 20px; text-shadow: 1px 1px 2px rgba(0,0,0,0.05); }
        h2 { font-size: 1.8rem; border-bottom: 2px dashed var(--border-color); padding-bottom: 10px; display: inline-block; }
        p { margin-bottom: 15px; font-size: 1.1rem; }
    </style>
</head>
<body>
    <!-- المحتوى يوضع هنا -->
</body>
</html>
```

## 3. أمثلة مفصلة لمكونات واجهة المستخدم (UI Components)

عند تصميم المحتوى، يجب استخدام الأكواد والتنسيقات التالية لضمان تطابق الهوية البصرية:

### أ. الأزرار (Buttons)
الأزرار يجب أن تحتوي على زوايا دائرية، انتقال سلس (Transition)، وتأثير الرفع عند تمرير الماوس (Hover).

```html
<style>
    .btn-primary {
        display: inline-flex; align-items: center; gap: 8px;
        background-color: var(--primary); color: #fff;
        padding: 12px 25px; border-radius: 8px; font-weight: bold; font-size: 1.1rem;
        text-decoration: none; border: 2px solid var(--primary);
        transition: all 0.3s ease; box-shadow: 0 4px 6px rgba(140, 90, 53, 0.2);
    }
    .btn-primary:hover {
        background-color: transparent; color: var(--primary); transform: translateY(-3px);
    }

    .btn-secondary {
        display: inline-flex; align-items: center; gap: 8px;
        background-color: var(--accent); color: var(--primary-hover);
        padding: 10px 20px; border-radius: 20px; font-weight: 900; font-size: 0.95rem;
        text-decoration: none; border: 1px solid var(--accent-dark);
        transition: all 0.3s ease;
    }
    .btn-secondary:hover {
        background-color: var(--accent-dark); color: #fff; transform: translateY(-2px);
    }
</style>

<!-- الاستخدام -->
<a href="#" class="btn-primary"><i class="fas fa-download"></i> تحميل الآن</a>
<a href="#" class="btn-secondary">اقرأ المزيد</a>
```

### ب. البطاقات والخلفيات الفرعية (Cards & Sub-backgrounds)
استخدم البطاقات لتمييز المحتوى المهم (مثل الميزات، الاقتباسات، أو التنبيهات). البطاقات تعتمد على خلفيات ورقية دافئة مع حدود خشبية فاتحة.

```html
<style>
    .info-card {
        background: var(--card-bg);
        border: 1px solid var(--border-color);
        border-right: 5px solid var(--primary);
        border-radius: 12px;
        padding: 20px 25px;
        margin: 20px 0;
        box-shadow: 0 8px 15px rgba(0,0,0,0.03);
        transition: transform 0.3s ease;
    }
    .info-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 12px 25px rgba(140, 90, 53, 0.1);
    }
    .info-card h3 { margin-bottom: 10px; font-size: 1.4rem; display: flex; align-items: center; gap: 10px; }
</style>

<!-- الاستخدام -->
<div class="info-card" data-aos="fade-up">
    <h3><i class="fas fa-leaf"></i> ملاحظة هامة</h3>
    <p>هذا النص يظهر داخل بطاقة ذات خلفية دافئة، مثالية لجذب انتباه القارئ لميزة معينة أو تحذير.</p>
</div>
```

### ج. الكود المضمن والأوامر البرمجية (Code Blocks)
عند عرض أكواد برمجية في المقالات التقنية، يجب أن تكون متوافقة مع الألوان الترابية للموقع بدلاً من الأسود القاتم المعتاد.

```html
<style>
    .code-block {
        background-color: #2A1F1A; /* بني داكن جداً كلون لحاء الشجرة */
        color: #FAEDCD; /* لون الورق الفاتح للنص */
        padding: 15px 20px;
        border-radius: 10px;
        font-family: 'Courier New', Courier, monospace;
        direction: ltr; /* هام للأكواد */
        text-align: left;
        overflow-x: auto;
        border: 1px solid #4A3525;
        margin: 20px 0;
        box-shadow: inset 0 4px 10px rgba(0,0,0,0.5);
    }
    .inline-code {
        background-color: rgba(212, 163, 115, 0.2);
        color: var(--primary-hover);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 0.9em;
    }
</style>

<!-- الاستخدام -->
<p>قم بتشغيل الأمر التالي عبر <span class="inline-code">CMD</span>:</p>
<pre class="code-block"><code>npm install jidhe-ui --save</code></pre>
```

### د. القوائم الجميلة (Styled Lists)
تجنب القوائم النقطية العادية، استخدم أيقونات متوافقة مع البيئة والطبيعة أو الصح بشكل أنيق.

```html
<style>
    .custom-list {
        list-style: none; padding: 0; margin: 20px 0;
    }
    .custom-list li {
        position: relative; padding-right: 30px; margin-bottom: 12px; font-size: 1.1rem;
    }
    .custom-list li::before {
        content: '\f06c'; /* أيقونة ورقة شجر من FontAwesome */
        font-family: 'Font Awesome 6 Free'; font-weight: 900;
        position: absolute; right: 0; top: 2px;
        color: var(--accent-dark); font-size: 1.2rem;
    }
</style>

<!-- الاستخدام -->
<ul class="custom-list">
    <li>سرعة تحميل فائقة وتصميم متجاوب.</li>
    <li>دعم كامل للوضع الليلي (Dark Mode).</li>
    <li>هوية بصرية مستوحاة من الطبيعة.</li>
</ul>
```

## 4. إرشادات تحسين محركات البحث (SEO Guidelines)
لضمان تصدر الموقع والمقالة في محركات البحث، يجب مراعاة التالي بصرامة عند توليد الكود:
1. **الترتيب الهرمي للعناوين:** يجب أن تحتوي الصفحة على `<h1>` واحد فقط يعبر عن الموضوع الرئيسي للمقال المضمن.
2. **الوسوم الدلالية (Semantic HTML):** استخدم وسوم `<article>`, `<section>`, `<header>`, `<main>`, `<figure>` لتوضيح بنية المحتوى.
3. **وصف الصور (Alt Text):** أي صورة تدرجها يجب أن تحتوي على `alt` بوصف دقيق ومختصر للمحتوى باللغة العربية. مثال: `<img src="tree.jpg" alt="صورة لشجرة جذع تمثل الهوية">`.
4. **تجنب التكرار والحشو:** اجعل المحتوى غنياً بالكلمات المفتاحية الطبيعية بدون حشو زائد.

## 5. ملاحظات أخيرة للـ AI
1. **الاندماج السلس (Transparent Body):** تأكد دائماً أن `background: transparent;` مطبقة على `body` حتى تأخذ الصفحة لون خلفية الموقع الأب تلقائياً، سواء كان في الوضع النهاري أو الليلي.
2. **تأثيرات AOS:** لا تتردد في إضافة خصائص الانيميشن المتوفرة في نظام الموقع (مثل `data-aos="fade-up"` أو `data-aos="zoom-in"`) على البطاقات والأقسام لإضافة حيوية.
3. **الابتكار ضمن القيود:** ابدع في تصميم الواجهات (UI) واستخدم مرونة الـ Grid والـ Flexbox، ولكن **لا تخرج عن لوحة الألوان المحددة (Color Palette)** المذكورة أعلاه. أي ألوان أخرى ستبدو غريبة (Alien) على الموقع وستشوه الهوية البصرية.
