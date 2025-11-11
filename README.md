# Workshop Management System 🏢

A comprehensive workshop management system built with Node.js, Express, SQLite, and vanilla JavaScript for managing employees, sections, and income tracking.

![Workshop System]
![Node.js]
![SQLite]

## 🌟 Features

### 👨‍💼 Admin Panel
- **Dashboard Overview**: Real-time statistics and summaries
- **Employee Management**: Add, edit, and manage employees
- **Income Tracking**: Update and monitor employee income
- **Section Management**: Organize employees by departments
- **Progress Monitoring**: Track target achievements with visual progress bars
- **Notes System**: Communicate with employees through notes

### 👤 Employee Panel
- **Personal Dashboard**: View personal targets and achievements
- **Income Overview**: Monitor current income and remaining targets
- **Progress Tracking**: Visual progress bars for goal achievement
- **Notes Communication**: Exchange notes with management
- **Responsive Design**: Mobile-friendly interface

### 🔐 Authentication System
- **Role-based Access**: Separate admin and employee portals
- **Secure Login**: Protected routes and session management
- **Auto-redirect**: Smart navigation based on user roles

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone (https://github.com/omar-bakhsh/workshop_manager)
cd workshop-system
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the application**
```bash
npm start
```

4. **Access the application**
```
Open your browser and navigate to: http://localhost:3000
```

## 📁 Project Structure

```
workshop-system/
├── server.js              # Main server file
├── package.json           # Project dependencies
├── db.sqlite              # Database file (auto-generated)
├── login.html            # Login page
├── admin.html            # Admin dashboard
├── employee.html         # Employee dashboard
└── README.md             # Project documentation
```

## 🗃️ Database Schema

### Tables
- **users**: User accounts and authentication
- **employees**: Employee information and targets
- **sections**: Department sections (مكانيكا, كهرباء, كشف, ادارة)
- **entries**: Income records and notes

## 👥 Default Accounts

### Admin Account
- **Username**: `admin`
- **Password**: `admin123`

### Sample Employee Accounts
- **وسن**: `wesam` / `123456`
- **أحمد**: `ahmed` / `123456`
- **فاطمة**: `fatima` / `123456`
- **نادر**: `nadir` / `102030`

## 🛠️ API Endpoints

### Authentication
- `POST /api/login` - User authentication

### Employees
- `GET /api/employees` - Get all employees
- `GET /api/employees/:id` - Get specific employee
- `POST /api/employees` - Add new employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Income Management
- `POST /api/employees/:id/income` - Add/update income
- `GET /api/employees/:id/entries` - Get income history

### Sections
- `GET /api/sections` - Get all sections
- `GET /api/sections-summary` - Get sections with summaries

## 🎨 Features Overview

### Admin Features
- 📊 Real-time dashboard with statistics
- 👥 Complete employee management
- 💰 Income tracking and updates
- 📈 Visual progress indicators
- 💬 Internal communication system
- 🎯 Target setting and monitoring

### Employee Features
- 👤 Personal dashboard
- 📊 Income and target overview
- 📈 Progress visualization
- 💬 Communication with management
- 📱 Mobile-responsive design

## 🔧 Technical Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite with sqlite3
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Authentication**: Session-based with localStorage
- **Styling**: Custom CSS with responsive design

## 🌐 Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers

## 📱 Responsive Design

The application is fully responsive and works seamlessly on:
- Desktop computers
- Tablets
- Mobile phones

## 🚀 Deployment

### Local Development
```bash
npm start
```

### Production Deployment
1. Set environment variables if needed
2. Ensure Node.js is installed on the server
3. Run `npm start` or use PM2 for process management

## 🔒 Security Features

- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Role-based access control
- Secure authentication

## 📈 Performance

- Lightweight SQLite database
- Optimized queries
- Efficient client-side rendering
- Minimal dependencies

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Change port in server.js or use:
   PORT=3001 node server.js
   ```

2. **Database errors**
   ```bash
   # Delete db.sqlite and restart server
   rm db.sqlite
   npm start
   ```

3. **Dependencies issues**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

## 📞 Support

For support and questions:
+966543201512

## 🎯 Future Enhancements

- [ ] Export reports to PDF/Excel
- [ ] Advanced analytics and charts
- [ ] Email notifications
- [ ] Multi-language support
- [ ] Advanced user roles
- [ ] Backup and restore functionality

---

**Built with ❤️ for efficient workshop management**
