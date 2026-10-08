'use client';

import React from 'react';
import { motion } from 'framer-motion';

// --- بيانات العائلة ---
const pioneers = [
  {
    name: "الشيخ منصور أحمد حويت (رحمه الله)",
    desc: "الذي بذل جهداً مضنياً ومشكوراً في جمع وتوثيق عدد كبير من أفراد العائلة بشكل سردي دقيق، ليكون نواة لعملنا اليوم."
  },
  {
    name: "الحاج السيد موسى حويت (رحمه الله)",
    desc: "الذي أبدع في تصميم شجرة خاصة بـ 'فرع المكنة'، ورسمها بحب وإتقان في لوحة فنية راقية تتفرع منها الأغصان والأوراق لتحفظ أسماء الأجداد."
  },
  {
    name: "الأستاذ محمد عبدالوهاب حويت",
    desc: "الذي استكمل المسيرة بجمع أفراد فرع المكنة بشكل سردي، في جهد طيب ومشكور حفظ الكثير من تفاصيل الفرع."
  }
];

const modernTeam = [
  {
    name: "الدكتور رأفت عبدالفتاح حويت (حفظه الله)",
    desc: "مرجعنا الأصيل الذي لم يبخل علينا يوماً بوقته أو بذاكرته. ورغم مشقة البحث والتوثيق، لم يتكاسل أبداً عن تقديم أي معلومة أو نصيحة تُنير لنا الطريق في تجميع وتدقيق فروع الشجرة."
  },
  {
    name: "المهندس مجدي السيد حويت",
    desc: "المؤسس الحقيقي لهذا المشروع بشكله الرقمي. أخذ على عاتقه نقل شجرة العائلة من الورق إلى عالم التكنولوجيا، وقام بجمع وتنسيق قاعدة بيانات ضخمة، وتطوير تطبيق حديث."
  },
  {
    name: "المهندس عبداللطيف طه حويت",
    desc: "صاحب الهمة العالية والمجهود الجبار في التواصل المباشر. أخذ على عاتقه الاتصال بمعظم أفراد العائلة فرداً فرداً للسؤال عن تفاصيل أجدادهم وأبنائهم، فكان له الفضل الأكبر في تجميع هذا الكم الهائل."
  },
  {
    name: "الأستاذ سلامة حويت",
    desc: "الأب الروحي والداعم الدائم لهذا المشروع. لم يبخل علينا بتوجيهاته، وكان دائم السؤال عن تفاصيل العمل وآخر المستجدات، يزرع فينا الأمل ويبث فينا العزيمة."
  }
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

const specialThanks = [
  "الأستاذ أسامة محمد عبدالمجيد حويت",
  "الأستاذ ثروت موسى حويت",
  "الأستاذ محمد عبدالعظيم حويت"
];

// --- إعدادات الحركات ---
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
};

export default function AboutUsPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-amber-600 selection:text-white pb-20 relative overflow-hidden">
      
      {/* خلفية زخرفية */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-amber-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 relative z-10">
        
        {/* رأس الصفحة */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-4 text-amber-500">
            <span className="w-12 h-[1px] bg-amber-500/50"></span>
            <span className="text-2xl">۞</span>
            <span className="w-12 h-[1px] bg-amber-500/50"></span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 leading-normal pb-2">
            من نحن – جذور ممتدة وأغصان مثمرة
          </h1>
          <p className="text-lg md:text-xl leading-relaxed text-slate-300 max-w-3xl mx-auto font-light">
            أهلاً بكم في الموقع الرسمي لشجرة عائلة <span className="text-amber-400 font-bold">"حويت"</span>.
            نحن عائلة نعتز بجذورنا الأصيلة الممتدة لقبيلة الحويطات العريقة، وبأجدادنا الذين سطروا تاريخاً من العزة والمحبة والأصالة. هذا الموقع لم يُبنَ في يوم وليلة، بل هو ثمرة حب، وحلم توارثته الأجيال لربط الماضي بالحاضر، وتوثيق صلة الرحم لتكون شجرتنا مرجعاً ووثيقة فخر لكل ابن وحفيد.
          </p>
        </motion.div>

        {/* قسم الرواد */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="mb-20">
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-amber-500 mb-8 flex items-center gap-3">
            <span className="text-xl">❖</span> رواد التوثيق الأوائل (جيل الرواد)
          </motion.h2>
          <motion.p variants={fadeUp} className="text-slate-400 mb-8 text-lg">
            لم تكن هذه النسخة الحديثة لترى النور لولا البذور الطيبة التي غرسها كبارنا في الماضي، ونذكر من أصحاب الفضل:
          </motion.p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pioneers.map((person, idx) => (
              <motion.div key={idx} variants={fadeUp} className="bg-slate-900/80 border border-amber-900/30 rounded-2xl p-6 hover:border-amber-500/50 transition-all duration-300 shadow-lg shadow-black/50 group">
                <h3 className="text-xl font-bold text-amber-300 mb-3 group-hover:text-amber-400">{person.name}</h3>
                <p className="text-slate-400 leading-relaxed text-sm md:text-base">{person.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* قسم صناع العمل الحديث */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="mb-20">
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-amber-500 mb-8 flex items-center gap-3">
            <span className="text-xl">❖</span> رحلة التوثيق الحديثة (صُناع هذا العمل)
          </motion.h2>
          <motion.p variants={fadeUp} className="text-slate-400 mb-8 text-lg">
            أما هذا الصرح الرقمي الذي بين أيديكم اليوم، فهو نتاج شهور طويلة من العمل المتواصل، والبحث، والمراجعة. ووراء هذا الإنجاز فريق عمل نذر وقته وجهده لخدمة العائلة:
          </motion.p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {modernTeam.map((person, idx) => (
              <motion.div key={idx} variants={fadeUp} className="bg-gradient-to-br from-slate-900 to-slate-900/50 border border-amber-900/30 rounded-2xl p-6 hover:border-amber-500/50 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-2 h-full bg-amber-600/50 group-hover:bg-amber-500 transition-colors" />
                <h3 className="text-xl font-bold text-amber-300 mb-3 pr-4">{person.name}</h3>
                <p className="text-slate-400 leading-relaxed text-sm md:text-base pr-4">{person.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* قسم عظماء العائلة */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="mb-20">
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-amber-500 mb-8 flex items-center gap-3">
            <span className="text-xl">❖</span> عظماء في ذاكرة العائلة
          </motion.h2>
          <motion.p variants={fadeUp} className="text-slate-400 mb-8 text-lg">
            كما نرفع قبعات الاحترام والتقدير لشخصيات عظيمة كان لها دور بارز في تاريخ العائلة وحفظ كيانها، ونذكر منهم:
          </motion.p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {greatFigures.map((person, idx) => (
              <motion.div key={idx} variants={fadeUp} className="flex items-start gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                <div className="w-12 h-12 rounded-full bg-amber-900/30 flex items-center justify-center shrink-0 border border-amber-700/50">
                  <span className="text-amber-500 text-xl">♔</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-200 mb-2">{person.name}</h3>
                  <p className="text-slate-400 text-sm">{person.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* قسم الشكر الخاص */}
        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="mb-20 text-center">
          <motion.h2 variants={fadeUp} className="text-2xl font-bold text-amber-500 mb-6">
            شكر خاص وتقدير
          </motion.h2>
          <motion.p variants={fadeUp} className="text-slate-400 mb-6 max-w-2xl mx-auto">
            لا يسعنا في هذا المقام إلا أن نتقدم بخالص الشكر والتقدير لكل من شاركنا ولو بجهد يسير في بناء هذه الشجرة، ونخص بالذكر:
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-4">
            {specialThanks.map((name, idx) => (
              <span key={idx} className="px-6 py-3 rounded-full bg-slate-800/80 border border-amber-900/40 text-amber-100 shadow-sm">
                {name}
              </span>
            ))}
          </motion.div>
        </motion.section>

        {/* الكلمة الختامية */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center bg-gradient-to-t from-amber-900/10 to-transparent p-10 rounded-3xl border border-amber-900/20">
          <div className="text-4xl text-amber-600 mb-4">❝</div>
          <p className="text-xl text-slate-300 leading-loose max-w-3xl mx-auto font-light">
            هذا الموقع هو هديتنا لكل فرد يحمل اسم <span className="text-amber-400 font-bold">"حويت"</span>. صممناه ليكون بيتاً كبيراً يجمعنا، وشجرة نستظل بها جميعاً. نسأل الله أن يديم بيننا المحبة والمودة، وأن تظل شجرتنا مثمرة وممتدة بالخير دائماً وأبداً.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8 text-amber-500/50">
            <span className="w-16 h-[1px] bg-amber-500/30"></span>
            <span>✦</span>
            <span className="w-16 h-[1px] bg-amber-500/30"></span>
          </div>
        </motion.div>

      </div>
    </div>
  );
}