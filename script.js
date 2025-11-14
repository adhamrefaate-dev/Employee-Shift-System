// Shift Management System
class ShiftManager {
    constructor() {
        this.currentUser = null;
        
        // جلب البيانات المخزنة أو استخدام البيانات الافتراضية
        this.users = JSON.parse(localStorage.getItem('shiftUsers') || JSON.stringify([
            {
                "code": "101",
                "password": "1243", 
                "name": "Admin User",
                "type": "admin"
            },
            {
                "code": "111",
                "password": "12121122",
                "name": "Ahmed Mohamed",
                "type": "user"
            },
            {
                "code": "112", 
                "password": "5678",
                "name": "Sara Ali",
                "type": "user"
            }
        ]));
        
        this.logs = JSON.parse(localStorage.getItem('shiftLogs') || '[]');
        
        this.shiftInterval = null;
        this.breakInterval = null;
        this.shiftStartTime = null;
        this.breakStartTime = null;
        this.currentBreakType = null;
        
        // إحصائيات البريكس
        this.totalBreakTime = 0; // إجمالي وقت البريكس بالمللي ثانية
        this.currentShiftBreakTime = 0; // إجمالي وقت البريكس للشفت الحالي
        this.breakCount = 0;     // عدد البريكس
        
        this.init();
    }

    init() {
        console.log('System initialized');
        console.log('Available users:', this.users);
        this.checkAuthentication();
        this.setupEventListeners();
        this.setupFilterListeners(); // إضافة المستمعين للفلتر
        this.updateUI();
        
        // تحميل اللوجس وتعبئة الفلتر أول ما تفتح صفحة الأدمن
        if (window.location.href.includes('admin-dashboard.html')) {
            this.populateUserFilter();
            this.displayFilteredLogs(this.logs);
        }
    }

    // التحقق من المصادقة
    checkAuthentication() {
        const currentPath = window.location.pathname;
        const currentHref = window.location.href;
        
        console.log('Current path:', currentPath);
        console.log('Current href:', currentHref);
        
        // جلب بيانات الجلسة
        const session = JSON.parse(localStorage.getItem('currentSession') || '{}');
        this.currentUser = session.user || null;

        console.log('Current user:', this.currentUser);

        // إذا مش مسجل دخول وموجود في صفحة مش اللوجين
        if (!this.currentUser && !currentHref.includes('index.html')) {
            console.log('Not logged in, redirecting to login...');
            window.location.href = 'index.html';
            return;
        }

        // إذا مسجل دخول وموجود في صفحة غلط
        if (this.currentUser) {
            console.log('User type:', this.currentUser.type);
            if (this.currentUser.type === 'admin' && currentHref.includes('user-dashboard.html')) {
                window.location.href = 'admin-dashboard.html';
            } else if (this.currentUser.type === 'user' && currentHref.includes('admin-dashboard.html')) {
                window.location.href = 'user-dashboard.html';
            }
        }
    }

    // إعداد المستمعين للأحداث
    setupEventListeners() {
        // تسجيل الدخول
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // تحديث الواجهة كل ثانية
        setInterval(() => {
            this.updateUI();
        }, 1000);
    }

    // إعداد المستمعين للفلتر - جديد
    setupFilterListeners() {
        const userFilter = document.getElementById('userFilter');
        const dateFrom = document.getElementById('dateFrom');
        const dateTo = document.getElementById('dateTo');
        
        if (userFilter) {
            userFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }
        
        if (dateFrom) {
            dateFrom.addEventListener('change', () => {
                this.applyFilters();
            });
        }
        
        if (dateTo) {
            dateTo.addEventListener('change', () => {
                this.applyFilters();
            });
        }
    }

    // معالجة تسجيل الدخول
    handleLogin() {
        const userCode = document.getElementById('userCode').value.trim();
        const password = document.getElementById('password').value;
        const messageDiv = document.getElementById('message');

        console.log('Login attempt - Code:', userCode, 'Password:', password);
        console.log('Available users:', this.users);

        if (!userCode || !password) {
            this.showMessage('Please enter both code and password!', 'error');
            return;
        }

        // البحث عن المستخدم
        const user = this.users.find(u => u.code === userCode && u.password === password);
        
        if (user) {
            console.log('Login successful:', user);
            this.currentUser = user;
            
            // حفظ الجلسة
            localStorage.setItem('currentSession', JSON.stringify({
                user: user,
                loginTime: new Date().toISOString()
            }));

            // تسجيل حدث الدخول
            this.logEvent('LOGIN');

            this.showMessage(`Welcome ${user.name}! Redirecting...`, 'success');
            
            // الانتقال للصفحة المناسبة
            setTimeout(() => {
                if (user.type === 'admin') {
                    console.log('Redirecting to admin dashboard');
                    window.location.href = 'admin-dashboard.html';
                } else {
                    console.log('Redirecting to user dashboard');
                    window.location.href = 'user-dashboard.html';
                }
            }, 1500);
        } else {
            console.log('Login failed - Invalid credentials');
            this.showMessage('Invalid user code or password!', 'error');
        }
    }

    // دوال واجهة المستخدم
    startShift() {
        if (!this.currentUser) {
            this.showNotification('Please login first!', 'error');
            return;
        }

        this.shiftStartTime = new Date();
        // إعادة تعيين إحصائيات البريكس للشفت الجديد
        this.totalBreakTime = 0;
        this.currentShiftBreakTime = 0; // إعادة تعيين إجمالي وقت البريكس للشفت
        this.breakCount = 0;
        
        this.logEvent('SHIFT_START');
        this.showNotification('Shift started successfully!');
        this.startShiftTimer();
        this.updateStatistics();
    }

    endShift() {
        if (!this.currentUser || !this.shiftStartTime) return;

        const shiftEndTime = new Date();
        const shiftDuration = shiftEndTime - this.shiftStartTime;
        
        // عرض إجمالي وقت البريكس في الإشعار
        this.logEvent('SHIFT_END', '', this.formatTime(shiftDuration));
        this.showNotification(
            `Shift ended. Duration: ${this.formatTime(shiftDuration)} - ` +
            `Total Breaks: ${this.breakCount} - ` +
            `Break Time: ${this.formatTime(this.currentShiftBreakTime)}`
        );
        
        this.shiftStartTime = null;
        this.stopTimers();
        
        // حفظ إحصائيات البريكس
        localStorage.setItem(`breakStats_${this.currentUser.code}`, JSON.stringify({
            totalBreakTime: this.totalBreakTime,
            currentShiftBreakTime: this.currentShiftBreakTime, // حفظ إجمالي وقت البريكس للشفت
            breakCount: this.breakCount,
            date: new Date().toISOString()
        }));
    }

    startBreak(breakType) {
        if (!this.currentUser || !this.shiftStartTime) {
            this.showNotification('Please start shift first!', 'error');
            return;
        }

        this.breakStartTime = new Date();
        this.currentBreakType = breakType;
        
        this.logEvent('BREAK_START', breakType);
        this.showNotification(`${breakType} started`);
        this.startBreakTimer();
    }

    endBreak() {
        if (!this.currentUser || !this.breakStartTime) return;

        const breakEndTime = new Date();
        const breakDuration = breakEndTime - this.breakStartTime;
        
        // تحديث إحصائيات البريكس
        this.totalBreakTime += breakDuration;
        this.currentShiftBreakTime += breakDuration; // تحديث إجمالي وقت البريكس للشفت
        this.breakCount++;
        
        this.logEvent('BREAK_END', this.currentBreakType, this.formatTime(breakDuration));
        this.showNotification(`${this.currentBreakType} ended. Duration: ${this.formatTime(breakDuration)}`);
        
        this.breakStartTime = null;
        this.currentBreakType = null;
        this.stopBreakTimer();
        
        this.updateStatistics();
    }

    // التايمرات
    startShiftTimer() {
        this.stopTimers();
        this.shiftInterval = setInterval(() => {
            if (this.shiftStartTime) {
                const now = new Date();
                const diff = now - this.shiftStartTime;
                const shiftTimer = document.getElementById('shiftTimer');
                if (shiftTimer) {
                    shiftTimer.textContent = this.formatTime(diff);
                }
            }
        }, 1000);
    }

    startBreakTimer() {
        this.stopBreakTimer();
        this.breakInterval = setInterval(() => {
            if (this.breakStartTime) {
                const now = new Date();
                const diff = now - this.breakStartTime;
                const breakTimer = document.getElementById('breakTimer');
                if (breakTimer) {
                    breakTimer.textContent = this.formatTime(diff);
                }
            }
        }, 1000);
    }

    stopTimers() {
        if (this.shiftInterval) clearInterval(this.shiftInterval);
        if (this.breakInterval) clearInterval(this.breakInterval);
    }

    stopBreakTimer() {
        if (this.breakInterval) clearInterval(this.breakInterval);
    }

    // تسجيل الأحداث
    logEvent(eventType, breakType = '', duration = '') {
        const logEntry = {
            userCode: this.currentUser.code,
            event: eventType,
            breakType: breakType,
            duration: duration,
            timestamp: new Date().toISOString(),
            // إضافة إحصائيات البريكس للأحداث المهمة
            breakStats: eventType === 'SHIFT_END' ? {
                totalBreaks: this.breakCount,
                totalBreakTime: this.currentShiftBreakTime
            } : null
        };

        this.logs.push(logEntry);
        localStorage.setItem('shiftLogs', JSON.stringify(this.logs));
        
        // تحديث الجدول في صفحة الأدمن لو كانت مفتوحة
        if (window.location.href.includes('admin-dashboard.html')) {
            this.displayFilteredLogs(this.logs);
        }
    }

    // تحديث الواجهة
    updateUI() {
        this.updateUserInfo();
        this.updateTimers();
        this.updateStatistics();
        this.updateUserList();
    }

    updateUserInfo() {
        const currentUserElement = document.getElementById('currentUser');
        if (currentUserElement && this.currentUser) {
            currentUserElement.textContent = this.currentUser.name;
        }
    }

    updateTimers() {
        // تحديث أزرار التحكم
        const startShiftBtn = document.getElementById('startShiftBtn');
        const endShiftBtn = document.getElementById('endShiftBtn');
        const endBreakBtn = document.getElementById('endBreakBtn');
        const breakTimer = document.getElementById('breakTimer');

        if (startShiftBtn) startShiftBtn.disabled = !!this.shiftStartTime;
        if (endShiftBtn) endShiftBtn.disabled = !this.shiftStartTime;
        
        if (endBreakBtn) {
            endBreakBtn.style.display = this.breakStartTime ? 'block' : 'none';
        }
        if (breakTimer) {
            breakTimer.style.display = this.breakStartTime ? 'block' : 'none';
        }
    }

    updateStatistics() {
        // إحصائيات واجهة الأدمن
        const totalUsers = document.getElementById('totalUsers');
        if (totalUsers) {
            totalUsers.textContent = this.users.filter(u => u.type === 'user').length;
        }

        const totalShifts = document.getElementById('totalShifts');
        if (totalShifts) {
            totalShifts.textContent = this.logs.filter(log => log.event === 'SHIFT_START').length;
        }

        const totalBreaks = document.getElementById('totalBreaks');
        if (totalBreaks) {
            totalBreaks.textContent = this.logs.filter(log => log.event === 'BREAK_START').length;
        }

        // إحصائيات واجهة المستخدم
        const totalLoginTime = document.getElementById('totalLoginTime');
        const currentBreakTime = document.getElementById('currentBreakTime');
        const totalBreaksCount = document.getElementById('totalBreaksCount');
        const currentBreakType = document.getElementById('currentBreakType');
        const totalBreaksTime = document.getElementById('totalBreaksTime');
        const totalBreakTimeElement = document.getElementById('totalBreakTime'); // العنصر الجديد

        // وقت اللوجين الإجمالي (من بداية الشفت)
        if (totalLoginTime && this.shiftStartTime) {
            const now = new Date();
            const loginDuration = now - this.shiftStartTime;
            totalLoginTime.textContent = this.formatTime(loginDuration);
        } else if (totalLoginTime) {
            totalLoginTime.textContent = '00:00:00';
        }

        // وقت البريك الحالي
        if (currentBreakTime && this.breakStartTime) {
            const now = new Date();
            const breakDuration = now - this.breakStartTime;
            currentBreakTime.textContent = this.formatTime(breakDuration);
        } else if (currentBreakTime) {
            currentBreakTime.textContent = '00:00:00';
        }

        // عدد البريكس الإجمالي خلال الشفت
        if (totalBreaksCount) {
            totalBreaksCount.textContent = this.breakCount;
        }

        // نوع البريك الحالي
        if (currentBreakType) {
            currentBreakType.textContent = this.currentBreakType || '-';
        }

        // إجمالي وقت البريكس خلال الشفت
        if (totalBreaksTime) {
            totalBreaksTime.textContent = this.formatTime(this.totalBreakTime);
        }

        // إجمالي وقت البريكس خلال الشفت الحالي (العنصر الجديد)
        if (totalBreakTimeElement) {
            totalBreakTimeElement.textContent = this.formatTime(this.currentShiftBreakTime);
        }

        // تحديث متوسط وقت الشفت
        const avgShiftTime = document.getElementById('avgShiftTime');
        if (avgShiftTime) {
            const shifts = this.logs.filter(log => log.event === 'SHIFT_START').length;
            if (shifts > 0) {
                avgShiftTime.textContent = '02:30';
            } else {
                avgShiftTime.textContent = '00:00';
            }
        }
    }

    // دالة جديدة لتعبة الفلتر باليوزرز
    populateUserFilter() {
        const userFilter = document.getElementById('userFilter');
        if (!userFilter) return;

        // مسح الخيارات الحالية
        userFilter.innerHTML = '<option value="">All Users</option>';
        
        // إضافة كل اليوزرز
        this.users.forEach(user => {
            if (user.type === 'user') { // بس اليوزرز العاديين
                const option = document.createElement('option');
                option.value = user.code;
                option.textContent = `${user.name} (${user.code})`;
                userFilter.appendChild(option);
            }
        });
    }

    updateUserList() {
        const usersList = document.getElementById('usersList');
        if (usersList) {
            const regularUsers = this.users.filter(u => u.type === 'user');
            usersList.innerHTML = regularUsers.map(user => `
                <div class="user-item">
                    <div class="user-info">
                        <div class="user-code">${user.code}</div>
                        <div class="user-name">${user.name}</div>
                    </div>
                    <div class="user-actions">
                        <button class="edit-btn" onclick="app.editUser('${user.code}')">✏️ Edit</button>
                    </div>
                </div>
            `).join('');
        }
        
        // تحديث الفلتر بعد أي تعديل في اليوزرز
        this.populateUserFilter();
    }

    // دوال الأدمن - الفلتر
    applyFilters() {
        const filteredLogs = this.getFilteredLogs();
        this.displayFilteredLogs(filteredLogs);
        
        if (filteredLogs.length === 0) {
            this.showNotification('No logs found with current filters', 'info');
        } else {
            this.showNotification(`Found ${filteredLogs.length} logs`, 'success');
        }
    }

    getFilteredLogs() {
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;
        const userFilter = document.getElementById('userFilter').value;
        
        let filteredLogs = this.logs;

        // فلترة حسب المستخدم
        if (userFilter) {
            filteredLogs = filteredLogs.filter(log => log.userCode === userFilter);
        }

        // فلترة حسب التاريخ
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            filteredLogs = filteredLogs.filter(log => {
                const logDate = new Date(log.timestamp);
                return logDate >= fromDate;
            });
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999); // علشان يشمل اليوم كله
            filteredLogs = filteredLogs.filter(log => {
                const logDate = new Date(log.timestamp);
                return logDate <= toDate;
            });
        }

        console.log('Filtered logs:', filteredLogs);
        return filteredLogs;
    }

    displayFilteredLogs(logs) {
        const logsTable = document.getElementById('logsTable');
        if (!logsTable) return;

        if (logs.length === 0) {
            logsTable.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No logs found</td></tr>';
            return;
        }

        logsTable.innerHTML = logs.map((log, index) => `
            <tr>
                <td>${this.getUserName(log.userCode)}</td>
                <td>${log.userCode}</td>
                <td>${this.formatEventType(log.event)}</td>
                <td>${log.breakType || '-'}</td>
                <td>${log.duration || '-'}</td>
                <td>${this.formatDateTime(log.timestamp)}</td>
                <td>
                    <button class="delete-btn" onclick="app.deleteLog(${index})" 
                            title="Delete this log">
                        🗑️ Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // دوال الحذف الجديدة
    deleteLog(logIndex) {
        if (confirm('Are you sure you want to delete this log?')) {
            // البحث عن الـ log الحقيقي في المصفوفة الأصلية
            const filteredLogs = this.getFilteredLogs();
            const logToDelete = filteredLogs[logIndex];
            
            // إيجاد الـ index في المصفوفة الأصلية
            const originalIndex = this.logs.findIndex(log => 
                log.timestamp === logToDelete.timestamp && 
                log.userCode === logToDelete.userCode &&
                log.event === logToDelete.event
            );
            
            if (originalIndex !== -1) {
                this.logs.splice(originalIndex, 1);
                localStorage.setItem('shiftLogs', JSON.stringify(this.logs));
                this.applyFilters(); // إعادة تطبيق الفلتر لتحديث العرض
                this.showNotification('Log deleted successfully!');
            }
        }
    }

    deleteAllLogs() {
        if (confirm('Are you sure you want to delete ALL logs? This action cannot be undone!')) {
            this.logs = [];
            localStorage.setItem('shiftLogs', JSON.stringify(this.logs));
            this.applyFilters();
            this.showNotification('All logs deleted successfully!');
        }
    }

    deleteCurrentUserLogs() {
        if (!this.currentUser) return;
        
        if (confirm(`Are you sure you want to delete all logs for ${this.currentUser.name}?`)) {
            this.logs = this.logs.filter(log => log.userCode !== this.currentUser.code);
            localStorage.setItem('shiftLogs', JSON.stringify(this.logs));
            this.applyFilters();
            this.showNotification(`All logs for ${this.currentUser.name} deleted!`);
        }
    }

    // دوال مساعدة للفلتر
    getUserName(userCode) {
        const user = this.users.find(u => u.code === userCode);
        return user ? user.name : 'Unknown User';
    }

    formatEventType(event) {
        const eventTypes = {
            'LOGIN': '🔐 Login',
            'SHIFT_START': '▶️ Shift Start',
            'SHIFT_END': '⏹️ Shift End', 
            'BREAK_START': '☕ Break Start',
            'BREAK_END': '⏹️ Break End'
        };
        return eventTypes[event] || event;
    }

    formatDateTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    resetFilters() {
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        document.getElementById('userFilter').value = '';
        
        // عرض كل اللوجس تاني
        this.displayFilteredLogs(this.logs);
        this.showNotification('Filters reset successfully!');
    }

    showAddUserModal() {
        document.getElementById('addUserModal').style.display = 'flex';
    }

    hideAddUserModal() {
        document.getElementById('addUserModal').style.display = 'none';
    }

    addNewUser() {
        const code = document.getElementById('newUserCode').value;
        const name = document.getElementById('newUserName').value;
        const password = document.getElementById('newUserPassword').value;

        if (!code || !name || !password) {
            this.showNotification('Please fill all fields!', 'error');
            return;
        }

        if (this.users.find(u => u.code === code)) {
            this.showNotification('User code already exists!', 'error');
            return;
        }

        const newUser = {
            code: code,
            password: password,
            name: name,
            type: 'user'
        };

        this.users.push(newUser);
        localStorage.setItem('shiftUsers', JSON.stringify(this.users));
        this.updateUserList();
        this.hideAddUserModal();
        this.showNotification('User added successfully!');
    }

    editUser(userCode) {
        const user = this.users.find(u => u.code === userCode);
        if (user) {
            document.getElementById('editUserCode').value = user.code;
            document.getElementById('editUserName').value = user.name;
            document.getElementById('editUserPassword').value = '';
            document.getElementById('editUserModal').style.display = 'flex';
        }
    }

    hideEditUserModal() {
        document.getElementById('editUserModal').style.display = 'none';
    }

    updateUser() {
        const code = document.getElementById('editUserCode').value;
        const name = document.getElementById('editUserName').value;
        const password = document.getElementById('editUserPassword').value;

        const user = this.users.find(u => u.code === code);
        if (user) {
            user.name = name;
            if (password) {
                user.password = password;
            }
            localStorage.setItem('shiftUsers', JSON.stringify(this.users));
            this.updateUserList();
            this.hideEditUserModal();
            this.showNotification('User updated successfully!');
        }
    }

    exportToExcel() {
        const filteredLogs = this.getFilteredLogs();
        
        let csv = 'User Name,User Code,Event Type,Break Type,Duration,Timestamp\n';
        filteredLogs.forEach(log => {
            const userName = this.getUserName(log.userCode);
            csv += `"${userName}","${log.userCode}","${log.event}","${log.breakType}","${log.duration}","${log.timestamp}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shift_data_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();

        this.showNotification('Data exported successfully!');
    }

    // دوال مساعدة
    formatTime(ms) {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    showMessage(text, type) {
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = `message ${type}`;
        }
    }

    showNotification(message, type = 'success') {
        alert(type === 'error' ? '❌ ' + message : '✅ ' + message);
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentSession');
        this.stopTimers();
        window.location.href = 'index.html';
    }
}

// Initialize the application
const app = new ShiftManager();