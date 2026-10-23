// DRAFT policy text for professional / legal review. Square-bracket items must be filled by the owner.
// These are NOT legal declarations. In production they stay hidden until VITE_POLICIES_APPROVED=true.
export type Slug = 'shipping' | 'returns' | 'privacy' | 'terms' | 'grievance' | 'distributor-terms'
export const POLICIES: Record<Slug, { mr: string[]; en: string[] }> = {
  shipping: {
    mr: ['ऑर्डरची पेमेंट पडताळणी झाल्यानंतर ऑर्डर पाठवली जाते.', 'डिलिव्हरीचा अंदाजे कालावधी: [मालकाने भरावा].', 'डिलिव्हरी शुल्क ऑर्डर करताना दाखवले जाते.', 'ट्रॅकिंग क्रमांक उपलब्ध झाल्यावर "माझ्या ऑर्डर्स" मध्ये दिसतो.'],
    en: ['Orders ship after payment is verified.', 'Estimated delivery time: [owner to fill in].', 'The delivery charge is shown when you order.', 'The tracking number appears under "My orders" once available.'],
  },
  returns: {
    mr: ['पोहोचण्याच्या तारखेपासून [मालकाने दिवस भरावेत] दिवसांत परतीची विनंती करता येते.', 'पेमेंट झाल्यानंतर, पाठवण्यापूर्वी ऑर्डर रद्द करता येते.', 'मंजूर परतीवर रिफंड [मालकाने कालावधी भरावा] मध्ये दिला जातो.', 'परत केलेल्या विक्रीवरील कमिशन उलटवले जाते.'],
    en: ['A return can be requested within [owner to fill in] days of delivery.', 'An order can be cancelled before it is shipped.', 'Approved returns are refunded within [owner to fill in].', 'Commission on returned sales is reversed.'],
  },
  privacy: {
    mr: ['आम्ही नाव, फोन, ईमेल आणि पत्ता फक्त ऑर्डर पूर्ण करण्यासाठी घेतो.', 'आम्ही कार्ड क्रमांक, UPI PIN किंवा बँक पासवर्ड कधीही मागत नाही.', 'वितरकांना ग्राहकाचा फोन किंवा पत्ता दिसत नाही.', 'डेटा हटवण्याच्या विनंतीसाठी संपर्क: [मालकाने भरावा].'],
    en: ['We collect name, phone, email and address only to fulfil orders.', 'We never ask for card numbers, UPI PINs or bank passwords.', 'Distributors cannot see a customer\'s phone or address.', 'To request data deletion, contact: [owner to fill in].'],
  },
  terms: {
    mr: ['किंमती INR मध्ये आहेत. GST किमतीत समाविष्ट आहे की वेगळा हे प्रत्येक उत्पादनावर दाखवले आहे.', 'अंतिम रक्कम ऑर्डर करताना सर्व्हर ठरवतो.', 'स्टॉक संपल्यास ऑर्डर नाकारली जाऊ शकते.', 'कायदेशीर अटी: [वकिलाकडून तपासून घ्याव्यात].'],
    en: ['Prices are in INR. Each product shows whether GST is included or extra.', 'The server sets the final amount when you order.', 'An order may be declined if stock runs out.', 'Legal terms: [to be reviewed by a lawyer].'],
  },
  grievance: {
    mr: ['तक्रार नोंदवण्यासाठी "माझ्या ऑर्डर्स" मधून किंवा संपर्क पानावरून कळवा.', 'तक्रारीला क्रमांक दिला जातो.', 'तक्रार निवारण अधिकारी: [मालकाने नाव व संपर्क भरावा].', 'निवारणाचा कालावधी: [मालकाने भरावा].'],
    en: ['Raise a complaint from "My orders" or the contact page.', 'Each complaint gets a number.', 'Grievance officer: [owner to fill in name and contact].', 'Resolution time: [owner to fill in].'],
  },
  'distributor-terms': {
    mr: ['वितरक होण्यासाठी कोणतेही शुल्क नाही आणि कोणताही स्टॉक विकत घेणे आवश्यक नाही.', 'मोबदला फक्त मंजूर वितरकाने आणलेल्या प्रत्यक्ष, पात्र उत्पादन विक्रीवर टक्केवारीने मिळतो.', 'सदस्य जोडल्याबद्दल किंवा नोंदणीसंख्येबद्दल कोणताही मोबदला नाही.', 'कोणतेही उत्पन्न हमखास नाही.', 'मोबदला देणे सध्या बंद आहे; ते कायदेशीर पुनरावलोकनानंतरच सुरू होईल.'],
    en: ['There is no fee to become a distributor and no stock purchase is required.', 'Compensation is a percentage of genuine, eligible product sales by an approved distributor only.', 'There is no payment for recruiting members or for registration counts.', 'No income is guaranteed.', 'Payouts are currently switched off and will start only after legal review.'],
  },
}
