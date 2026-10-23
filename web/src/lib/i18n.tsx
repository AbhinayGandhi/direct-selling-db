import { createContext, useContext, useState, type ReactNode } from 'react'

const mr = {
  home: 'मुख्यपृष्ठ', products: 'उत्पादने', cart: 'कार्ट', orders: 'माझ्या ऑर्डर्स', login: 'लॉगिन', logout: 'बाहेर पडा',
  search: 'उत्पादन शोधा', allCategories: 'सर्व प्रकार', loading: 'लोड होत आहे…', retry: 'पुन्हा प्रयत्न करा',
  loadError: 'माहिती मिळाली नाही. इंटरनेट तपासून पुन्हा प्रयत्न करा.', noProducts: 'कोणतेही उत्पादन सापडले नाही.',
  addToCart: 'कार्टमध्ये टाका', inStock: 'उपलब्ध', outOfStock: 'सध्या उपलब्ध नाही', mrp: 'MRP', gstIncl: 'GST किमतीत समाविष्ट',
  gstExcl: 'GST वेगळा', next: 'पुढे', prev: 'मागे', emptyCart: 'कार्ट रिकामे आहे.', browse: 'उत्पादने पाहा', remove: 'काढा',
  subtotal: 'उपमूल्य', tax: 'GST (समाविष्ट/अतिरिक्त)', delivery: 'डिलिव्हरी', total: 'एकूण', estimateNote: 'ही रक्कम अंदाजे आहे. अंतिम रक्कम ऑर्डर करताना सर्व्हर ठरवतो.',
  checkout: 'ऑर्डर करा', needLogin: 'ऑर्डर करण्यासाठी लॉगिन करा. वितरक बनणे आवश्यक नाही.',
  name: 'पूर्ण नाव', phone: 'मोबाईल क्रमांक', address: 'पत्ता', city: 'शहर', state: 'राज्य', pincode: 'पिनकोड', email: 'ईमेल', password: 'पासवर्ड',
  payment: 'पेमेंट पद्धत', payUpi: 'UPI (मॅन्युअल पडताळणी)', payBank: 'बँक ट्रान्सफर (मॅन्युअल पडताळणी)', payCod: 'डिलिव्हरीवर रोख',
  payNote: 'पेमेंट मिळाल्याची आमच्याकडून पडताळणी होईपर्यंत ऑर्डर प्रलंबित राहते. पेमेंट तपशील ऑर्डरनंतर कळवले जातील.',
  placeOrder: 'ऑर्डर नोंदवा', placing: 'नोंदवत आहे…', orderPlaced: 'ऑर्डर नोंदवली गेली. ऑर्डर क्रमांक:', refCode: 'रेफरल कोड (असल्यास)',
  signup: 'नवीन खाते', signin: 'लॉगिन', fullName: 'पूर्ण नाव', forgot: 'पासवर्ड विसरलात?', resetSent: 'पासवर्ड रीसेट लिंक ईमेलवर पाठवली (ईमेल सेटिंग चालू असल्यास).',
  checkEmail: 'खाते तयार झाले. ईमेल पडताळणी चालू असल्यास ईमेल तपासा.', haveAccount: 'आधीच खाते आहे?', noAccount: 'खाते नाही?',
  cancelOrder: 'ऑर्डर रद्द करा', noOrders: 'अजून ऑर्डर नाहीत.', tracking: 'ट्रॅकिंग', status: 'स्थिती', payStatus: 'पेमेंट',
  notConfigured: 'अॅप अजून Supabase शी जोडलेले नाही. .env मध्ये VITE_SUPABASE_URL आणि VITE_SUPABASE_ANON_KEY टाका.',
  salesOff: 'ऑर्डर घेणे सध्या सुरू केलेले नाही.', draftBanner: 'मसुदा: हा मजकूर व्यावसायिक/कायदेशीर पुनरावलोकनासाठी आहे. अद्याप मान्य केलेला नाही.',
  policyUnavailable: 'हे धोरण लवकरच उपलब्ध होईल.', contact: 'संपर्क', policies: 'धोरणे', shipping: 'शिपिंग धोरण', returns: 'रद्द/परत/रिफंड धोरण',
  privacy: 'गोपनीयता धोरण', terms: 'अटी व शर्ती', grievance: 'तक्रार निवारण', distTerms: 'वितरक अटी व मोबदला माहिती',
  heroTitle: 'घरपोच उत्पादने, स्पष्ट किंमत', heroText: 'वितरक न होता सुद्धा तुम्ही थेट खरेदी करू शकता.',
  fieldsRequired: 'सर्व आवश्यक माहिती भरा.', badPincode: 'पिनकोड 6 अंकी असावा.', qty: 'संख्या', unavailableInCart: 'कार्टमधील काही उत्पादन आता उपलब्ध नाही. ते काढा.',
  language: 'English', deliveryInfo: 'डिलिव्हरी: ऑर्डर नंतर शिपिंग धोरणानुसार.', companyMissing: 'कंपनीची अधिकृत माहिती अजून भरलेली नाही.',
} as const

const en: Record<keyof typeof mr, string> = {
  home: 'Home', products: 'Products', cart: 'Cart', orders: 'My orders', login: 'Log in', logout: 'Log out',
  search: 'Search products', allCategories: 'All categories', loading: 'Loading…', retry: 'Try again',
  loadError: 'Could not load data. Check your connection and try again.', noProducts: 'No products found.',
  addToCart: 'Add to cart', inStock: 'In stock', outOfStock: 'Currently unavailable', mrp: 'MRP', gstIncl: 'GST included in price',
  gstExcl: 'GST extra', next: 'Next', prev: 'Previous', emptyCart: 'Your cart is empty.', browse: 'Browse products', remove: 'Remove',
  subtotal: 'Subtotal', tax: 'GST (included/extra)', delivery: 'Delivery', total: 'Total', estimateNote: 'This amount is an estimate. The server sets the final amount when you order.',
  checkout: 'Checkout', needLogin: 'Log in to place an order. You do not need to become a distributor.',
  name: 'Full name', phone: 'Mobile number', address: 'Address', city: 'City', state: 'State', pincode: 'Pincode', email: 'Email', password: 'Password',
  payment: 'Payment method', payUpi: 'UPI (manual verification)', payBank: 'Bank transfer (manual verification)', payCod: 'Cash on delivery',
  payNote: 'Your order stays pending until we verify payment. Payment details are shared after you order.',
  placeOrder: 'Place order', placing: 'Placing order…', orderPlaced: 'Order placed. Order number:', refCode: 'Referral code (if any)',
  signup: 'Create account', signin: 'Log in', fullName: 'Full name', forgot: 'Forgot password?', resetSent: 'Password reset link sent by email (if email is configured).',
  checkEmail: 'Account created. If email verification is on, check your email.', haveAccount: 'Already have an account?', noAccount: 'No account?',
  cancelOrder: 'Cancel order', noOrders: 'No orders yet.', tracking: 'Tracking', status: 'Status', payStatus: 'Payment',
  notConfigured: 'The app is not connected to Supabase yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.',
  salesOff: 'Ordering has not been switched on yet.', draftBanner: 'DRAFT: this text is for professional/legal review and has not been approved.',
  policyUnavailable: 'This policy will be available soon.', contact: 'Contact', policies: 'Policies', shipping: 'Shipping policy', returns: 'Cancellation, return and refund policy',
  privacy: 'Privacy policy', terms: 'Terms and conditions', grievance: 'Grievance redressal', distTerms: 'Distributor terms and compensation disclosure',
  heroTitle: 'Products at your door, clear prices', heroText: 'You can buy directly without becoming a distributor.',
  fieldsRequired: 'Fill in all required fields.', badPincode: 'Pincode must be 6 digits.', qty: 'Quantity', unavailableInCart: 'Some items in your cart are no longer available. Remove them.',
  language: 'मराठी', deliveryInfo: 'Delivery: after the order, as per the shipping policy.', companyMissing: 'Official company details have not been entered yet.',
}

export type Key = keyof typeof mr
type Lang = 'mr' | 'en'
const Ctx = createContext<{ lang: Lang; t: (k: Key) => string; toggle: () => void }>({ lang: 'mr', t: (k) => mr[k], toggle: () => {} })

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => { try { return localStorage.getItem('lang') === 'en' ? 'en' : 'mr' } catch { return 'mr' } })
  const toggle = () => setLang((l) => { const n: Lang = l === 'mr' ? 'en' : 'mr'; try { localStorage.setItem('lang', n) } catch { /* ignore */ } document.documentElement.lang = n; return n })
  const t = (k: Key) => (lang === 'mr' ? mr[k] : en[k])
  return <Ctx.Provider value={{ lang, t, toggle }}>{children}</Ctx.Provider>
}
export const useI18n = () => useContext(Ctx)

export const STATUS_LABEL: Record<string, { mr: string; en: string }> = {
  pending: { mr: 'प्रलंबित', en: 'Pending' }, confirmed: { mr: 'निश्चित', en: 'Confirmed' }, processing: { mr: 'प्रक्रियेत', en: 'Processing' },
  shipped: { mr: 'पाठवले', en: 'Shipped' }, delivered: { mr: 'पोहोचले', en: 'Delivered' }, cancelled: { mr: 'रद्द', en: 'Cancelled' },
  return_requested: { mr: 'परतीची विनंती', en: 'Return requested' }, returned: { mr: 'परत केले', en: 'Returned' },
  refund_pending: { mr: 'रिफंड प्रलंबित', en: 'Refund pending' }, refunded: { mr: 'रिफंड झाले', en: 'Refunded' }, payment_failed: { mr: 'पेमेंट अयशस्वी', en: 'Payment failed' },
  pending_verification: { mr: 'पडताळणी प्रलंबित', en: 'Awaiting verification' }, paid: { mr: 'मिळाले', en: 'Paid' }, failed: { mr: 'अयशस्वी', en: 'Failed' },
  partially_refunded: { mr: 'अंशतः रिफंड', en: 'Partially refunded' },
}
