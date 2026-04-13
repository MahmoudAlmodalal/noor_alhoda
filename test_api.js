const http = require('http');

const payload = {
  rows: [
    {
      full_name: "عمر محمد نايف أبو ناجي",
      national_id: "432477347",
      birthdate: "2011-12-12",
      grade: "9",
      mobile: "598833948",
      whatsapp: "598833948",
      address: "صيدلية طالب",
      health_status: "ابن شهيد",
      skills: "قراءة القرآن/ شعر",
      previous_courses: "تاهيلية",
      guardian_name: "منى حمدان أبو ناجي",
      guardian_national_id: "803088756",
      guardian_mobile: "598833948",
      bank_account_number: "598833948",
      bank_account_name: "منى أبو ناجي",
      bank_account_type: "بنك فلسطين",
      teacher_name: "انس أبو نبهان",
      follow_up: "أوقاف"
    }
  ]
};

const data = JSON.stringify(payload);

const req = http.request({
  hostname: 'localhost',
  port: 8000,
  path: '/api/students/bulk-create/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Response:', body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
