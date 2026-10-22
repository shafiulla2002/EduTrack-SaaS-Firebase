public with sharing class AttendanceController {

    @AuraEnabled
    public static List<Map<String, String>> getRecentSubmissions() {
        List<Map<String, String>> results = new List<Map<String, String>>();
        Date today = Date.today();

        List<Attendance_Session__c> todaySessions = (List<Attendance_Session__c>)Security.stripInaccessible(AccessType.READABLE, [
            SELECT Id, Class__r.Name, Section__r.Name, Attendance_Taken_By__r.Name
            FROM Attendance_Session__c
            WHERE Date__c = :today 
            AND Attendance_Taken_By__c != null
            ORDER BY CreatedDate DESC
            LIMIT 10 
        ]).getRecords();

        if (todaySessions.isEmpty()) {
            Map<String, String> item = new Map<String, String>();
            item.put('id', 'pending');
            item.put('text', 'Today\'s attendance is currently pending');
            results.add(item);
        } else {
            for (Attendance_Session__c s : todaySessions) {
                Map<String, String> item = new Map<String, String>();
                item.put('id', s.Id);
                String className   = (String)NamespaceUtils.getValue(s, 'Class__r.Name');
                String sectionName = (String)NamespaceUtils.getValue(s, 'Section__r.Name');
                String teacherName = (String)NamespaceUtils.getValue(s, 'Attendance_Taken_By__r.Name');
                if (className == null) className = 'N/A';
                if (sectionName == null) sectionName = 'N/A';
                if (teacherName == null) teacherName = 'N/A';
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
    @AuraEnabled
    public static List<Option> getClasses() {
        List<Option> options = new List<Option>();
        List<Class__c> records = (List<Class__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name FROM Class__c ORDER BY Name ASC LIMIT 500]).getRecords();
        for (Class__c cls : records) {
            options.add(new Option(cls.Name, cls.Name));
        }
        return options;
    }

    // ✅ FIX: Query Section__c object instead of picklist
    @AuraEnabled
    public static List<Option> getSections() {
        List<Option> options = new List<Option>();
        List<Section__c> records = (List<Section__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name FROM Section__c ORDER BY Name ASC LIMIT 500]).getRecords();
        for (Section__c sec : records) {
            options.add(new Option(sec.Name, sec.Name));
        }
        return options;
    }

    @AuraEnabled
    public static List<Map<String, String>> getTeachers() {
        List<Map<String, String>> teacherList = new List<Map<String, String>>();
        List<Account> teachers = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name, EduTrack__Subject__c FROM Account
                          WHERE Type = 'Teacher'
                          ORDER BY Name
                          LIMIT 1000]).getRecords();
        for (Account a : teachers) {
            Map<String, String> teacher = new Map<String, String>();
            teacher.put('id', a.Id);
            teacher.put('name', a.Name);
            teacher.put('subject', a.isSet(NamespaceUtils.withNamespace('Subject__c')) && NamespaceUtils.getValue(a, 'Subject__c') != null ? (String)NamespaceUtils.getValue(a, 'Subject__c') : 'N/A');
            teacherList.add(teacher);
        }
        return teacherList;
    }

    // ✅ FIX: Resolve Class/Section Name → Id, then filter by lookup Id
    @AuraEnabled
    public static List<Map<String, Object>> getStudents(String classVal, String sectionVal) {
        Id classId = null;
        Id sectionId = null;

        // Resolve Class name → Id
        List<Class__c> clsList = (List<Class__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id FROM Class__c WHERE Name = :classVal LIMIT 1]).getRecords();
        if (!clsList.isEmpty()) {
            classId = clsList[0].Id;
        }

        // Resolve Section name → Id
        List<Section__c> secList = (List<Section__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id FROM Section__c WHERE Name = :sectionVal LIMIT 1]).getRecords();
        if (!secList.isEmpty()) {
            sectionId = secList[0].Id;
        }

        if (classId == null || sectionId == null) {
            return new List<Map<String, Object>>();
        }

        return NamespaceUtils.stripNamespaceList((List<Account>)Security.stripInaccessible(AccessType.READABLE, [
            SELECT Id, Name, Roll_No__c
            FROM Account
            WHERE Class__c = :classId
            AND Section__c = :sectionId
            ORDER BY Name
            LIMIT 1000
        ]).getRecords());
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
        if (String.isBlank(classVal) || String.isBlank(sectionVal) || dateVal == null) {
            return data;
        }

        // Resolve Class name → Id
        Id classId = null;
        List<Class__c> clsList = (List<Class__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id FROM Class__c WHERE Name = :classVal LIMIT 1]).getRecords();
        if (!clsList.isEmpty()) {
            classId = clsList[0].Id;
        }

        // Resolve Section name → Id
        Id sectionId = null;
        List<Section__c> secList = (List<Section__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id FROM Section__c WHERE Name = :sectionVal LIMIT 1]).getRecords();
        if (!secList.isEmpty()) {
            sectionId = secList[0].Id;
        }

        if (classId == null || sectionId == null) {
            return data;
        }

        List<Attendance_Session__c> sessions = (List<Attendance_Session__c>)Security.stripInaccessible(AccessType.READABLE, [
            SELECT Id, Attendance_Taken_By__r.Name, CreatedDate, LastModifiedDate
            FROM Attendance_Session__c
            WHERE Class__c = :classId
            AND Section__c = :sectionId
            AND Date__c = :dateVal
            ORDER BY LastModifiedDate DESC
            LIMIT 1
        ]).getRecords();

        if (!sessions.isEmpty()) {
            Attendance_Session__c sess = sessions[0];
            data.sessionExists    = true;
            data.teacherName      = sess.Attendance_Taken_By__r != null ? sess.Attendance_Taken_By__r.Name : '';
            data.createdTime      = sess.CreatedDate.format('hh:mm a');
            data.lastUpdatedTime  = sess.LastModifiedDate.format('hh:mm a');

            for (Attendance__c att : (List<Attendance__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Student__c FROM Attendance__c
                                      WHERE Attendance_Session__c = :sess.Id
                                      LIMIT 2000
                                     ]).getRecords()) {
                Id studentId = (Id)NamespaceUtils.getValue(att, 'Student__c');
                if (studentId != null) {
                    data.absentIds.add(studentId);
                }
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
            List<Class__c> clsList = (List<Class__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id FROM Class__c WHERE Name = :classVal LIMIT 1]).getRecords();
            if (!clsList.isEmpty()) {
                classId = clsList[0].Id;
            } else {
                Class__c newClass = new Class__c(Name = classVal);
                SObjectAccessDecision decisionCls = Security.stripInaccessible(AccessType.CREATABLE, new List<Class__c>{newClass});
                insert decisionCls.getRecords();
                classId = decisionCls.getRecords()[0].Id;
            }

            // ✅ FIX: Resolve Section name → Id (create if missing)
            Id sectionId = null;
            List<Section__c> secList = (List<Section__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id FROM Section__c WHERE Name = :sectionVal LIMIT 1]).getRecords();
            if (!secList.isEmpty()) {
                sectionId = secList[0].Id;
            } else {
                Section__c newSection = new Section__c(Name = sectionVal);
                SObjectAccessDecision decisionSec = Security.stripInaccessible(AccessType.CREATABLE, new List<Section__c>{newSection});
                insert decisionSec.getRecords();
                sectionId = decisionSec.getRecords()[0].Id;
            }

            // Find or create Attendance Session
            List<Attendance_Session__c> sessions = (List<Attendance_Session__c>)Security.stripInaccessible(AccessType.READABLE, [
                SELECT Id FROM Attendance_Session__c
                WHERE Class__c = :classId
                AND Section__c = :sectionId
                AND Date__c = :attendanceDate
                ORDER BY CreatedDate ASC
                LIMIT 10
            ]).getRecords();

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
                    for (Integer i = 1; i < sessions.size(); i++) {
                        dupes.add(sessions[i]);
                    }
                    if (Schema.sObjectType.Attendance_Session__c.isDeletable()) {
                        delete dupes;
                    }
                }
            }

            session.Total_Students__c  = totalStudents;
            session.Present_Count__c   = presentCount;
            session.Absent_Count__c    = absentCount;
            try {
                session.Number_Of_Present__c = String.valueOf(presentCount);
                session.Number_Of_Absent__c  = String.valueOf(absentCount);
            } catch (Exception e) {
                System.debug('AttendanceController: Could not set Number_Of fields - ' + e.getMessage());
            }
            if (String.isNotBlank(teacherId)) {
                session.Attendance_Taken_By__c = teacherId;
            }
            if (session.Id != null) {
                if (!Schema.sObjectType.Attendance_Session__c.isUpdateable()) {
                    throw new AuraHandledException('Insufficient permissions to update attendance sessions.');
                }
                SObjectAccessDecision decisionUpdate = Security.stripInaccessible(AccessType.UPDATABLE, new List<Attendance_Session__c>{session});
                update decisionUpdate.getRecords();
            } else {
                if (!Schema.sObjectType.Attendance_Session__c.isCreateable()) {
                    throw new AuraHandledException('Insufficient permissions to create attendance sessions.');
                }
                SObjectAccessDecision decisionCreate = Security.stripInaccessible(AccessType.CREATABLE, new List<Attendance_Session__c>{session});
                insert decisionCreate.getRecords();
                session = (Attendance_Session__c) decisionCreate.getRecords()[0];
            }

            // Manage Attendance Records
            Map<Id, Account> absentStudentsMap = new Map<Id, Account>();
            if (!absentStudentIds.isEmpty()) {
                absentStudentsMap = new Map<Id, Account>(
                    [SELECT Id, EduTrack__Roll_No__c FROM Account WHERE Id IN :absentStudentIds WITH SECURITY_ENFORCED LIMIT 1000]
                );
            }

            List<Attendance__c> existingRecords = (List<Attendance__c>)Security.stripInaccessible(AccessType.READABLE, [
                SELECT Id, Student__c FROM Attendance__c
                WHERE Attendance_Session__c = :session.Id
                LIMIT 2000
            ]).getRecords();

            Set<String> existingAbsentIds = new Set<String>();
            List<Attendance__c> toDelete  = new List<Attendance__c>();

            for (Attendance__c att : existingRecords) {
                Id attStudentId = (Id)NamespaceUtils.getValue(att, 'Student__c');
                String attStudentIdStr = attStudentId != null ? String.valueOf(attStudentId) : null;
                if (attStudentIdStr == null || !absentStudentIds.contains(attStudentIdStr)) {
                    toDelete.add(att);
                } else {
                    existingAbsentIds.add(attStudentIdStr);
                }
            }
            if (!toDelete.isEmpty() && Schema.sObjectType.Attendance__c.isDeletable()) {
                delete toDelete;
            }

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
                        String rollNo = (String)NamespaceUtils.getValue(absentStudentsMap.get(studentId), 'Roll_No__c');
                        if (rollNo != null) newAtt.put('Roll_No__c', rollNo);
                    }
                    toInsert.add(newAtt);
                }
            }
            if (!toInsert.isEmpty()) {
                if (!Schema.sObjectType.Attendance__c.isCreateable()) {
                    throw new AuraHandledException('Insufficient permissions to create attendance records.');
                }
                SObjectAccessDecision decisionAtt = Security.stripInaccessible(AccessType.CREATABLE, toInsert);
                insert decisionAtt.getRecords();
            }

            return getSessionData(classVal, sectionVal, attendanceDate);

        } catch (Exception e) {
            Database.rollback(sp);
            throw new AuraHandledException('Error saving attendance: ' + e.getMessage());
        }
    }
}


