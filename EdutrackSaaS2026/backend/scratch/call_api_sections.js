const axios = require('axios');

async function run() {
  try {
    // Let's first log in as Baskar Don
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'baskar@gmail.com',
      password: 'password123' // or whatever password is used in seed
    });
    
    const token = loginRes.data.token;
    console.log("Logged in successfully, token retrieved");

    // Fetch classes
    const classesRes = await axios.get('http://localhost:5000/api/teacher-portal/attendance/classes', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Classes response:", classesRes.data);

    // Fetch sections for Class-2
    const sectionsRes = await axios.get('http://localhost:5000/api/teacher-portal/attendance/sections?classVal=Class-2', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Sections response for Class-2:", sectionsRes.data);

  } catch (err) {
    console.error("Error occurred:", err.response ? err.response.data : err.message);
  }
}

run();
