import * as Yup from 'yup';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;
const phoneRegex = /^\d{10,13}$/;
const emailRule = Yup.string().trim().required('Email is required').email('Enter a valid email address');

export const getPasswordStrength = (password = '') => {
  if (!password) return 'Weak';
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z\d]/.test(password)) score += 1;

  if (score >= 4) return 'Strong';
  if (score >= 2) return 'Medium';
  return 'Weak';
};

export const guestInfoValidationSchema = Yup.object().shape({
  fullName: Yup.string().required('Full name is required'),
  barangay: Yup.string().required('Barangay is required'),
  municipality: Yup.string().required('Municipality / City is required'),
  contactNumber: Yup.string().matches(phoneRegex, 'Enter a valid Philippine mobile number', { excludeEmptyString: true }),
});

export const loginValidationSchema = Yup.object().shape({
  email: emailRule,
  password: Yup.string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(passwordRegex, 'Password must include uppercase, lowercase, number, and special character'),
});

export const registerValidationSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: emailRule,
  password: Yup.string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(passwordRegex, 'Password must include uppercase, lowercase, number, and special character'),
  confirmPassword: Yup.string()
    .required('Confirm password is required')
    .oneOf([Yup.ref('password')], 'Passwords must match'),
  phoneNumber: Yup.string().matches(phoneRegex, 'Enter a valid Philippine mobile number', { excludeEmptyString: true }),
});
