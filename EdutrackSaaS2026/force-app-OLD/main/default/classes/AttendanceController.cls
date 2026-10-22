public without sharing class AttendanceController {

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getRecentSubmissions() {
        List<Map<String, String>> results = new List<Map<String, String>>();
        Date today = Date.today();

        List<Attendance_Session__c> todaySessions = [
            SELECT Id, Class__r.Name, Section__r.Name, Attendance_Taken_By__r.Name
            FROM Attendance_Session__c
            WHERE Date__c = :today 
            AND Attendance_Taken_By__c != null
            ORDER BY CreatedDate DESC
            LIMIT 10 
        ];

        if (todaySessions.isEmpty()) {
            Map<String, String> item = new Map<String, String>();
            item.put('id', 'pending');
            item.put('text', 'Today\'s attendance is currently pending');
            results.add(item);
        } else {
            for (Attendance_Session__c s : todaySessions) {
                Map<String, String> item = new Map<String, String>();
                item.put('id', s.Id);
                String className   = s.Class__r   != null ? s.Class__r.Name   : 'N/A';
                String sectionName = s.Section__r != null ? s.Section__r.Name : 'N/A';
                String teacherName = s.Attendance_Taken_By__r != null ? s.Attendance_Taken_By__r.Name : 'N/A';
                item.put('text', className + ' - ' + sectionName + ' submitted by ' + teacherName);
                results.add(item);
            }
        }
        return results;
    }

    public class Option {
        @AuraEnabled public String label;
        @AuraEnabled public String value;
        public Option(String label, String value) {
            this.label = label;
            this.value = value;
        }
    }

    // ✅ FIX: Query Class__c object instead of picklist
    @AuraEnabled(cacheable=true)
    public static List<Option> getClasses() {
        List<Option> options = new List<Option>();
        for (Class__c cls : [SELECT Id, Name FROM Class__c ORDER BY Name ASC]) {
            options.add(new Option(cls.Name, cls.Name)); // value = Name so filters work easily
        }
        return options;
    }

    // ✅ FIX: Query Section__c object instead of picklist
    @AuraEnabled(cacheable=true)
    public static List<Option> getSections() {
        List<Option> options = new List<Option>();
        for (Section__c sec : [SELECT Id, Name FROM Section__c ORDER BY Name ASC]) {
            options.add(new Option(sec.Name, sec.Name)); // value = Name so filters work easily
        }
        return options;
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getTeachers() {
        List<Map<String, String>> teacherList = new List<Map<String, String>>();
        for (Account a : [SELECT Id, Name, Subject__c FROM Account
                          WHERE IsPersonAccount = true AND Type = 'Teacher'
                          ORDER BY Name]) {
            Map<String, String> teacher = new Map<String, String>();
            teacher.put('id', a.Id);
            teacher.put('name', a.Name);
            teacher.put('subject', a.Subject__c != null ? a.Subject__c : 'N/A');
            teacherList.add(teacher);
        }
        return teacherList;
    }

    // ✅ FIX: Resolve Class/Section Name → Id, then filter by lookup Id
    @AuraEnabled
    public static List<Map<String, Object>> getStudents(String classVal, String sectionVal) {
        // Resolve Class name → Id
        Id classId = null;
        List<Class__c> clsList = [SELECT Id FROM Class__c WHERE Name = :classVal LIMIT 1];
        if (!clsList.isEmpty()) classId = clsList[0].Id;

        // Resolve Section name → Id
        Id sectionId = null;
        List<Section__c> secList = [SELECT Id FROM Section__c WHERE Name = :sectionVal LIMIT 1];
        if (!secList.isEmpty()) sectionId = secList[0].Id;

        if (classId == null || sectionId == null) return new List<Map<String, Object>>();

        return NamespaceUtils.stripNamespaceList([
            SELECT Id, Name, Roll_No__c
            FROM Account
            WHERE Class__c = :classId
            AND Section__c = :sectionId
            ORDER BY Name
        ]);
    }

    public class SessionData {
        @AuraEnabled public Boolean sessionExists;
        @AuraEnabled public List<String> absentIds;
        @AuraEnabled public Integer total;
        @AuraEnabled public Integer present;
        @AuraEnabled public Integer absent;
        @AuraEnabled public String teacherName;
        @AuraEnabled public String createdTime;
        @AuraEnabled public String lastUpdatedTime;

        public SessionData() {
            this.sessionExists   = false;
            this.absentIds       = new List<String>();
            this.total           = 0;
            this.present         = 0;
            this.absent          = 0;
        }
    }

    // ✅ FIX: Resolve Name → Id before querying session
    @AuraEnabled
    public static SessionData getSessionData(String classVal, String sectionVal, Date dateVal) {
        SessionData data = new SessionData();
        if (String.isBlank(classVal) || String.isBlank(sectionVal) || dateVal == null) return data;

        // Resolve Class name → Id
        Id classId = null;
        List<Class__c> clsList = [SELECT Id FROM Class__c WHERE Name = :classVal LIMIT 1];
        if (!clsList.isEmpty()) classId = clsList[0].Id;

        // Resolve Section name → Id
        Id sectionId = null;
        List<Section__c> secList = [SELECT Id FROM Section__c WHERE Name = :sectionVal LIMIT 1];
        if (!secList.isEmpty()) sectionId = secList[0].Id;

        if (classId == null || sectionId == null) return data;

        List<Attendance_Session__c> sessions = [
            SELECT Id, Attendance_Taken_By__r.Name, CreatedDate, LastModifiedDate
            FROM Attendance_Session__c
            WHERE Class__c = :classId
            AND Section__c = :sectionId
            AND Date__c = :dateVal
            ORDER BY LastModifiedDate DESC
            LIMIT 1
        ];

        if (!sessions.isEmpty()) {
            Attendance_Session__c sess = sessions[0];
            data.sessionExists    = true;
            data.teacherName      = sess.Attendance_Taken_By__r != null ? sess.Attendance_Taken_By__r.Name : '';
            data.createdTime      = sess.CreatedDate.format('hh:mm a');
            data.lastUpdatedTime  = sess.LastModifiedDate.format('hh:mm a');

            for (Attendance__c att : [SELECT Student__c FROM Attendance__c
                                      WHERE Attendance_Session__c = :sess.Id]) {
                data.absentIds.add(att.Student__c);
            }
        }
        return data;
    }

    @AuraEnabled
    public static SessionData saveAttendance(
        String classVal, String sectionVal, String dateStr,
        List<String> absentStudentIds, Integer totalStudents,
        Integer absentCount, Integer presentCount, String teacherId
    ) {
        if (classVal   != null) classVal   = classVal.trim();
        if (sectionVal != null) sectionVal = sectionVal.trim();
        if (absentStudentIds == null) absentStudentIds = new List<String>();
        if (String.isBlank(dateStr)) throw new AuraHandledException('Date is required.');

        Savepoint sp = Database.setSavepoint();
        try {
            Date attendanceDate = Date.valueOf(dateStr);

            // ✅ FIX: Resolve Class name → Id (create if missing)
            Id classId = null;
            List<Class__c> clsList = [SELECT Id FROM Class__c WHERE Name = :classVal LIMIT 1];
            if (!clsList.isEmpty()) {
                classId = clsList[0].Id;
            } else {
                Class__c newClass = new Class__c(Name = classVal);
                insert newClass;
                classId = newClass.Id;
            }

            // ✅ FIX: Resolve Section name → Id (create if missing)
            Id sectionId = null;
            List<Section__c> secList = [SELECT Id FROM Section__c WHERE Name = :sectionVal LIMIT 1];
            if (!secList.isEmpty()) {
                sectionId = secList[0].Id;
            } else {
                Section__c newSection = new Section__c(Name = sectionVal);
                insert newSection;
                sectionId = newSection.Id;
            }

            // Find or create Attendance Session
            List<Attendance_Session__c> sessions = [
                SELECT Id FROM Attendance_Session__c
                WHERE Class__c = :classId
                AND Section__c = :sectionId
                AND Date__c = :attendanceDate
                ORDER BY CreatedDate ASC
            ];

            Attendance_Session__c session;
            if (sessions.isEmpty()) {
                session = new Attendance_Session__c(
                    Class__c   = classId,
                    Section__c = sectionId,
                    Date__c    = attendanceDate
                );
            } else {
                session = sessions[0];
                // Delete duplicates if any
                if (sessions.size() > 1) {
                    List<Attendance_Session__c> dupes = new List<Attendance_Session__c>();
                    for (Integer i = 1; i < sessions.size(); i++) dupes.add(sessions[i]);
                    delete dupes;
                }
            }

            session.Total_Students__c  = totalStudents;
            session.Present_Count__c   = presentCount;
            session.Absent_Count__c    = absentCount;
            session.Number_Of_Present__c = String.valueOf(presentCount);
            session.Number_Of_Absent__c  = String.valueOf(absentCount);
            if (String.isNotBlank(teacherId)) {
                session.Attendance_Taken_By__c = teacherId;
            }
            upsert session;

            // Manage Attendance Records
            Map<Id, Account> absentStudentsMap = new Map<Id, Account>();
            if (!absentStudentIds.isEmpty()) {
                absentStudentsMap = new Map<Id, Account>(
                    [SELECT Id, Roll_No__c FROM Account WHERE Id IN :absentStudentIds]
                );
            }

            List<Attendance__c> existingRecords = [
                SELECT Id, Student__c FROM Attendance__c
                WHERE Attendance_Session__c = :session.Id
            ];

            Set<String> existingAbsentIds = new Set<String>();
            List<Attendance__c> toDelete  = new List<Attendance__c>();

            for (Attendance__c att : existingRecords) {
                if (!absentStudentIds.contains(att.Student__c)) {
                    toDelete.add(att);
                } else {
                    existingAbsentIds.add(att.Student__c);
                }
            }
            if (!toDelete.isEmpty()) delete toDelete;

            List<Attendance__c> toInsert = new List<Attendance__c>();
            for (String studentId : absentStudentIds) {
                if (!existingAbsentIds.contains(studentId)) {
                    Attendance__c newAtt = new Attendance__c(
                        Student__c            = studentId,
                        // ✅ FIX: store lookup Ids, not string names
                        Class__c              = classId,
                        Section__c            = sectionId,
                        Date__c               = attendanceDate,
                        Attendance_Session__c = session.Id,
                        Attendance_Status__c  = 'Absent'
                    );
                    if (absentStudentsMap.containsKey(studentId)) {
                        newAtt.Roll_No__c = absentStudentsMap.get(studentId).Roll_No__c;
                    }
                    toInsert.add(newAtt);
                }
            }
            if (!toInsert.isEmpty()) insert toInsert;

            return getSessionData(classVal, sectionVal, attendanceDate);

        } catch (Exception e) {
            Database.rollback(sp);
            throw new AuraHandledException('Error saving attendance: ' + e.getMessage());
        }
    }
}