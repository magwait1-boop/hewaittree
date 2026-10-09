'use client';

import React from 'react';
import Link from 'next/link';

const modernTeam = [
  {
    name: "الدكتور رأفت عبدالفتاح حويت (حفظه الله)",
    desc: "مرجعنا الأصيل الذي لم يبخل علينا يوماً بوقته أو بذاكرته. ورغم مشقة البحث والتوثيق، لم يتكاسل أبداً عن تقديم أي معلومة أو نصيحة تُنير لنا الطريق في تجميع وتدقيق فروع الشجرة."
  },
  {
    name: "المهندس مجدي السيد حويت",
    desc: "المؤسس الحقيقي لهذا المشروع بشكله الرقمي. أخذ على عاتقه نقل شجرة العائلة من الورق إلى عالم التكنولوجيا، وقام بجمع وتنسيق قاعدة بيانات ضخمة، وتطوير تطبيق حديث لإدارة الشجرة. وبعد تجارب وتحديثات مستمرة، خرج لنا الموقع بهذا الشكل التفاعلي المتميز الذي نواصل تطويره يوماً بعد يوم."
  },
  {
    name: "المهندس عبداللطيف طه حويت",
    desc: "صاحب الهمة العالية والمجهود الجبار في التواصل المباشر. هذا الرجل المحب لعائلته أخذ على عاتقه الاتصال بمعظم أفراد العائلة فرداً فرداً، للبحث والسؤال عن تفاصيل أجدادهم وأبنائهم، فكان له الفضل الأكبر في تجميع هذا الكم الهائل من الأسماء، وخاصة فرع سيدي العفيفي."
  },
  {
    name: "الأستاذ سلامة حويت",
    desc: "الأب الروحي والداعم الدائم لهذا المشروع. لم يبخل علينا بتوجيهاته، وكان دائم السؤال عن تفاصيل العمل وآخر المستجدات، يزرع فينا الأمل ويبث فينا العزيمة لإخراج هذا العمل بأفضل صورة."
  }
];

const pioneers = [
  {
    name: "الشيخ منصور أحمد حويت (رحمه الله)",
    desc: "الذي بذل جهداً مضنياً ومشكوراً في جمع وتوثيق عدد كبير من أفراد العائلة بشكل سردي دقيق، ليكون نواة لعملنا اليوم."
  },
  {
    name: "الحاج السيد موسى حويت (رحمه الله)",
    desc: "الذي أبدع في تصميم شجرة خاصة بـ \"فرع المكنة\"، ورسمها بحب وإتقان في لوحة فنية راقية تتفرع منها الأغصان والأوراق لتحفظ أسماء الأجداد."
  },
  {
    name: "الأستاذ محمد عبدالوهاب حويت",
    desc: "الذي استكمل المسيرة بجمع أفراد فرع المكنة بشكل سردي، في جهد طيب ومشكور حفظ الكثير من تفاصيل الفرع."
  }
];

const specialThanks = [
  "الأستاذ أسامة محمد عبدالمجيد حويت",
  "الأستاذ ثروت موسى حويت",
  "الأستاذ محمد عبدالعظيم حويت",
  "الاستاذ احمد علي عبدالخالق حويت",
  "الدكتور عمر جازي ابواليزيد حويت"
];

const greatFigures = [
  {
    name: "عميد الحويتة الحاج محمد عبدالمجيد حويت (رحمه الله)",
    desc: "الذي كان رمزاً للحكمة والجمع الطيب."
  },
  {
    name: "المهندس جازي أبو اليزيد حويت (حفظه الله)",
    desc: "صاحب المكانة المرموقة والعطاء المستمر."
  }
];

export default function AboutUsPage() {
  return (
    <div 
      dir="rtl" 
      className="custom-about-scroll fixed inset-0 w-screen h-screen overflow-y-scroll bg-slate-950 text-slate-200 z-50 selection:bg-amber-600 selection:text-white"
    >
      {/* تخصيص مظهر شريط التمرير ليتناسق تماماً مع الخلفية */}
      <style jsx global>{`
        /* إتاحة التمرير لشاشات المتصفح الحديثة */
        .custom-about-scroll {
          scrollbar-width: thin;
          scrollbar-color: #78350f #020617;
        }

        /* تخصيص ألوان وتصميم الـ Scrollbar لمتصفحات كروم وإيدج وسفاري */
        .custom-about-scroll::-webkit-scrollbar {
          width: 10px;
        }
        .custom-about-scroll::-webkit-scrollbar-track {
          background: #020617; /* نفس لون خلفية الصفحة slate-950 تماماً */
        }
        .custom-about-scroll::-webkit-scrollbar-thumb {
          background-color: #78350f; /* لون عنبري ذهبي داكن وأنيق */
          border-radius: 6px;
          border: 2px solid #020617; /* فراغ لوني متطابق مع الخلفية */
        }
        .custom-about-scroll::-webkit-scrollbar-thumb:hover {
          background-color: #b45309; /* إضاءة ذهبية خفيفة عند التمرير بالماوس */
        }
      `}</style>

      {/* شريط علوي للعودة والتنقل */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-amber-900/30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-amber-500 text-xl font-bold">عائلة حويت</span>
          <span className="text-xs text-amber-500/70 border border-amber-500/30 px-2 py-0.5 rounded-full">وثيقة وفاء وتاريخ</span>
        </div>
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 px-4 py-2 rounded-xl text-sm font-medium transition-all"
        >
          <span>←</span> العودة إلى الشجرة
        </Link>
      </header>

      {/* المحتوى الرئيسي */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-600/10 blur-[130px] rounded-full pointer-events-none" />

        {/* عنوان الصفحة */}
        <section className="text-center mb-16 relative z-10">
          <div className="flex items-center justify-center gap-4 mb-4 text-amber-500">
            <span className="w-12 h-[1px] bg-amber-500/50"></span>
            <span className="text-2xl">۞</span>
            <span className="w-12 h-[1px] bg-amber-500/50"></span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 pb-2">
            جذور ممتدة وأغصان مثمرة
          </h1>
        </section>

        {/* قسم رحلة التوثيق الحديثة */}
        <section className="mb-20 relative z-10">
          <h2 className="text-2xl md:text-3xl font-bold text-amber-500 mb-4 flex items-center gap-3">
            <span>❖</span> رحلة التوثيق الحديثة (صُناع هذا العمل)
          </h2>
          <p className="text-slate-400 mb-8 text-base md:text-lg">
            أما هذا الصرح الرقمي الذي بين أيديكم اليوم، فهو نتاج شهور طويلة من العمل المتواصل، والبحث، والمراجعة، والمشاورة المستمرة. ووراء هذا الإنجاز فريق عمل نذر وقته وجهده لخدمة العائلة:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {modernTeam.map((person, idx) => (
              <div key={idx} className="bg-slate-900/90 border-r-4 border-r-amber-500 border border-slate-800 rounded-2xl p-6 hover:border-amber-500/40 transition-all">
                <h3 className="text-lg font-bold text-amber-300 mb-2">{person.name}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{person.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* نبذة عن العائلة والموقع */}
        <section className="mb-20 relative z-10">
          <h2 className="text-2xl md:text-3xl font-bold text-amber-500 mb-4 flex items-center gap-3">
            <span>❖</span> نبذة عن العائلة والموقع
          </h2>
          <div className="bg-slate-900/70 p-8 rounded-2xl border border-amber-900/30">
            <p className="text-lg leading-relaxed text-slate-300 font-light">
              أهلاً بكم في الموقع الرسمي لشجرة عائلة <span className="text-amber-400 font-bold">"حويت"</span>.
              نحن عائلة نعتز بجذورنا الأصيلة الممتدة لقبيلة الحويطات العريقة، وبأجدادنا الذين سطروا تاريخاً من العزة والمحبة والأصالة. هذا الموقع لم يُبنَ في يوم وليلة، بل هو ثمرة حب، وحلم توارثته الأجيال لربط الماضي بالحاضر، وتوثيق صلة الرحم لتكون شجرتنا مرجعاً ووثيقة فخر لكل ابن وحفيد.
            </p>
          </div>
        </section>

        {/* قسم جيل الرواد */}
        <section className="mb-20 relative z-10">
          <h2 className="text-2xl md:text-3xl font-bold text-amber-500 mb-4 flex items-center gap-3">
            <span>❖</span> رواد التوثيق الأوائل (جيل الرواد)
          </h2>
          <p className="text-slate-400 mb-8 text-base md:text-lg">
            لم تكن هذه النسخة الحديثة لترى النور لولا البذور الطيبة التي غرسها كبارنا في الماضي، ونذكر من أصحاب الفضل:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pioneers.map((person, idx) => (
              <div key={idx} className="bg-slate-900/90 border border-amber-900/40 rounded-2xl p-6 hover:border-amber-500/50 transition-all shadow-md">
                <h3 className="text-lg font-bold text-amber-300 mb-3">{person.name}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{person.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* شكر خاص وتقدير */}
        <section className="mb-20 text-center relative z-10">
          <h2 className="text-2xl font-bold text-amber-500 mb-4">شكر خاص وتقدير</h2>
          <p className="text-slate-400 mb-8 max-w-2xl mx-auto text-sm md:text-base">
            لا يسعنا في هذا المقام إلا أن نتقدم بخالص الشكر والتقدير لكل من شاركنا ولو بجهد يسير في بناء هذه الشجرة، ونخص بالذكر:
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {specialThanks.map((name, idx) => (
              <span key={idx} className="px-5 py-2.5 rounded-full bg-slate-900 border border-amber-900/40 text-amber-200 text-sm font-medium">
                {name}
              </span>
            ))}
          </div>
        </section>

        {/* قسم عظماء في ذاكرة العائلة */}
        <section className="mb-20 relative z-10">
          <h2 className="text-2xl md:text-3xl font-bold text-amber-500 mb-4 flex items-center gap-3">
            <span>❖</span> عظماء في ذاكرة العائلة
          </h2>
          <p className="text-slate-400 mb-8 text-base md:text-lg">
            كما نرفع قبعات الاحترام والتقدير لشخصيات عظيمة كان لها دور بارز في تاريخ العائلة وحفظ كيانها، ونذكر منهم:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {greatFigures.map((person, idx) => (
              <div key={idx} className="flex items-start gap-4 bg-slate-900/70 p-6 rounded-2xl border border-amber-900/30">
                <div className="w-12 h-12 rounded-full bg-amber-950/60 border border-amber-700/50 flex items-center justify-center shrink-0">
                  <span className="text-amber-400 text-xl">♔</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-200 mb-2">{person.name}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{person.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* الكلمة الختامية */}
        <footer className="text-center bg-gradient-to-t from-amber-950/20 to-slate-900/40 p-10 rounded-3xl border border-amber-900/30 relative z-10">
          <div className="text-4xl text-amber-600 mb-4">❝</div>
          <p className="text-lg md:text-xl text-slate-300 leading-loose max-w-3xl mx-auto font-light">
            هذا الموقع هو هديتنا لكل فرد يحمل اسم <span className="text-amber-400 font-bold">"حويت"</span>. صممناه ليكون بيتاً كبيراً يجمعنا، وشجرة نستظل بها جميعاً. نسأل الله أن يديم بيننا المحبة والمودة، وأن تظل شجرتنا مثمرة وممتدة بالخير دائماً وأبداً.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8 text-amber-500/50">
            <span className="w-16 h-[1px] bg-amber-500/30"></span>
            <span>✦</span>
            <span className="w-16 h-[1px] bg-amber-500/30"></span>
          </div>
        </footer>

      </div>
    </div>
  );
}