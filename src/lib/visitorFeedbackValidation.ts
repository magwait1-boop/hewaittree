export interface VisitorFeedbackInput {
  name: string;
  phone: string;
  message: string;
}

export type VisitorFeedbackErrors = Partial<Record<keyof VisitorFeedbackInput, string>>;

export const FEEDBACK_LIMITS = { name: 100, phone: 50, message: 4000 } as const;

export function normalizePhone(value: string): string {
  const digits = value.replace(/[٠-٩۰-۹]/g, (character) => {
    const code = character.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
  return digits
    .trim()
    .replace(/[\s().-]/g, '')
    .replace(/^00/, '+');
}

export function validateVisitorFeedback(input: VisitorFeedbackInput): {
  value: VisitorFeedbackInput;
  errors: VisitorFeedbackErrors;
  valid: boolean;
} {
  const value = {
    name: input.name.trim().replace(/\s+/g, ' '),
    phone: normalizePhone(input.phone),
    message: input.message.trim(),
  };
  const errors: VisitorFeedbackErrors = {};

  if (
    value.name.length < 2 ||
    value.name.length > FEEDBACK_LIMITS.name ||
    !/\p{L}/u.test(value.name) ||
    Array.from(value.name).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    errors.name = 'أدخل اسمًا صحيحًا من حرفين إلى ١٠٠ حرف.';
  }
  if (input.phone.length > FEEDBACK_LIMITS.phone || !/^\+?[0-9]{7,15}$/.test(value.phone)) {
    errors.phone = 'أدخل رقم هاتف صحيحًا من ٧ إلى ١٥ رقمًا، مع رمز الدولة عند الحاجة.';
  }
  if (
    value.message.length < 5 ||
    value.message.length > FEEDBACK_LIMITS.message ||
    value.message.includes('\u0000')
  ) {
    errors.message = 'اكتب مقترحًا أو تعليقًا من ٥ إلى ٤٠٠٠ حرف.';
  }

  return { value, errors, valid: Object.keys(errors).length === 0 };
}
