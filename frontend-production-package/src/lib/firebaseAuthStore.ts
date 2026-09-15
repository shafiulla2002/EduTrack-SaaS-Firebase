import { ConfirmationResult } from 'firebase/auth';

let confirmationResult: ConfirmationResult | null = null;
let savedPhone: string = '';

export const setConfirmationResult = (result: ConfirmationResult | null) => {
  confirmationResult = result;
};

export const getConfirmationResult = (): ConfirmationResult | null => {
  return confirmationResult;
};

export const setSavedPhone = (phone: string) => {
  savedPhone = phone;
};

export const getSavedPhone = (): string => {
  return savedPhone;
};
