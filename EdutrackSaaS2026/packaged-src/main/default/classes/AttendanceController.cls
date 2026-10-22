public without sharing class AttendanceController {
    
    // Wrapper for Combobox Options
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getRecentSubmissions() {
        List<Map<String, String>> results = new List<Map<String, String>>();
        Date today = Date.today();
        
        List<Attendance_Session__c> todaySessions = [
            SELECT Id, Class__r.Name, Section__c, Attendance_Taken_By__r.Name 
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
                String className = s.Class__r != null ? s.Class__r.Name : 'N/A';
                String teacherName = s.Attendance_Taken_By__r != null ? s.Attendance_Taken_By__r.Name : 'N/A';
                item.put('text', className + ' - ' + s.Section__c + ' submitted by ' + teacherName);
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

    @AuraEnabled(cacheable=true)
    public static List<Option> getClasses() {
        return getPicklistValues('Account', 'Class__c');
    }

    @AuraEnabled(cacheable=true)
    public static List<Option> getSections() {
        return getPicklistValues('Account', 'Section__c');
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getTeachers() {
        List<Map<String, String>> teacherList = new List<Map<String, String>>();
        // Query Person Accounts where Type is 'Teacher'
        for (Account a : [SELECT PersonContactId, Name, Subject__c FROM Account WHERE IsPersonAccount = true AND Type = 'Teacher' ORDER BY Name]) {
            Map<String, String> teacher = new Map<String, String>();
            teacher.put('id', a.Id); // Using Account Id as the lookup now targets Account
            teacher.put('name', a.Name);
            teacher.put('subject', a.Subject__c != null ? a.Subject__c : 'N/A');
            teacherList.add(teacher);
        }
        return teacherList;
    }

    private static List<Option> getPicklistValues(String objectName, String fieldName) {
        List<Option> options = new List<Option>();
        Schema.SObjectType s = Schema.getGlobalDescribe().get(objectName);
        Schema.DescribeSObjectResult r = s.getDescribe();
        Map<String, Schema.SObjectField> fields = r.fields.getMap();

        Schema.SObjectField field = fields.get(fieldName);
        if (field == null) {
            // Search for namespaced version
            for (String key : fields.keySet()) {
                if (key.endsWith('__' + fieldName.toLowerCase())) {
                    field = fields.get(key);
                    break;
                }
            }
        }

        if (field != null) {
            Schema.DescribeFieldResult fieldResult = field.getDescribe();
            List<Schema.PicklistEntry> ple = fieldResult.getPicklistValues();
            
            for(Schema.PicklistEntry f : ple) {
                options.add(new Option(f.getLabel(), f.getValue()));
            }
        }
        return options;
    }

    @AuraEnabled
    public static List<Map<String, Object>> getStudents(String classVal, String sectionVal) {
        // Use INCLUDES for Class__c since it is a Multi-Select Picklist
        return NamespaceUtils.stripNamespaceList([SELECT Id, Name, Roll_No__c FROM Account 
                WHERE Class__c INCLUDES (:classVal) 
                AND Section__c = :sectionVal 
                ORDER BY Name]);
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
            this.sessionExists = false;
            this.absentIds = new List<String>();
            this.total = 0;
            this.present = 0;
            this.absent = 0;
        }
    }

    @AuraEnabled
    public static SessionData getSessionData(String classVal, String sectionVal, Date dateVal) {
        SessionData data = new SessionData();
        if (String.isBlank(classVal) || String.isBlank(sectionVal) || dateVal == null) return data;

        // 1. Find Session
        List<Attendance_Session__c> sessions = [
            SELECT Id, Attendance_Taken_By__r.Name, CreatedDate, LastModifiedDate 
            FROM Attendance_Session__c 
            WHERE (Class__r.Name = :classVal OR Class__c = :classVal) // Handle both Name and ID just in case
            AND Section__c = :sectionVal 
            AND Date__c = :dateVal 
            ORDER BY LastModifiedDate DESC // Get newest if multiple
            LIMIT 1
        ];

        if (!sessions.isEmpty()) {
            Attendance_Session__c sess = sessions[0];
            data.sessionExists = true;
            data.teacherName = sess.Attendance_Taken_By__r != null ? sess.Attendance_Taken_By__r.Name : '';
            data.createdTime = sess.CreatedDate.format('hh:mm a');
            data.lastUpdatedTime = sess.LastModifiedDate.format('hh:mm a');
            
            // 2. Get Absentees IF session exists
            for(Attendance__c att : [SELECT Student__c FROM Attendance__c 
                                     WHERE Attendance_Session__c = :sess.Id]) {
                data.absentIds.add(att.Student__c);
            }
        }
        
        return data;
    }

    @AuraEnabled
    public static List<String> getAbsentStudents(String classVal, String sectionVal, Date dateVal) {
        // Deprecated but kept for backward compatibility if needed temporarily
        return getSessionData(classVal, sectionVal, dateVal).absentIds;
    }

    @AuraEnabled
    public static SessionData saveAttendance(String classVal, String sectionVal, String dateStr, List<String> absentStudentIds, Integer totalStudents, Integer absentCount, Integer presentCount, String teacherId) {
        // Validations
        if(classVal != null) classVal = classVal.trim();
        if(sectionVal != null) sectionVal = sectionVal.trim();
        if(absentStudentIds == null) absentStudentIds = new List<String>();
        if(String.isBlank(dateStr)) throw new AuraHandledException('Date is required.');
        
        Savepoint sp = Database.setSavepoint();
        try {
            Date attendanceDate = Date.valueOf(dateStr);
            
            // Resolve Class Lookup for Session (since Session.Class__c is a Lookup)
            Id classId = null;
            if (String.isNotBlank(classVal)) {
                // Assuming Class__c object exists and has Name field matching the picklist value
                List<Class__c> classes = [SELECT Id FROM Class__c WHERE Name = :classVal LIMIT 1];
                if (!classes.isEmpty()) {
                    classId = classes[0].Id;
                }
            }
            
            // 1. Manage Attendance Session
            // Robust Session Lookup: Try ID first, then Name fallback
            List<Attendance_Session__c> sessions = new List<Attendance_Session__c>();
            
            // Fix: If ClassId is still null, it means no Class__c record exists for this name.
            // We MUST create it to ensure the session links correctly.
            if (classId == null && String.isNotBlank(classVal)) {
                Class__c newClass = new Class__c(Name = classVal);
                insert newClass;
                classId = newClass.Id;
            }

            if (classId != null) {
                 sessions = [SELECT Id FROM Attendance_Session__c 
                             WHERE Class__c = :classId 
                             AND Section__c = :sectionVal 
                             AND Date__c = :attendanceDate 
                             ORDER BY CreatedDate ASC]; // Get all to handle potential dupes
            } else {
                 // Fallback query (should not happen if we create class)
                 sessions = [SELECT Id FROM Attendance_Session__c 
                             WHERE Class__r.Name = :classVal 
                             AND Section__c = :sectionVal 
                             AND Date__c = :attendanceDate 
                             ORDER BY CreatedDate ASC];
            }
            
            Attendance_Session__c session;
            if(sessions.isEmpty()) {
                session = new Attendance_Session__c(
                    Class__c = classId,
                    Section__c = sectionVal,
                    Date__c = attendanceDate
                );
            } else {
                session = sessions[0];
                // Housekeeping: Delete duplicates
                if (sessions.size() > 1) {
                    List<Attendance_Session__c> dupesToDelete = new List<Attendance_Session__c>();
                    for (Integer i = 1; i < sessions.size(); i++) {
                        dupesToDelete.add(sessions[i]);
                    }
                    delete dupesToDelete;
                }
            }
            
            // Use counts from UI
            session.Total_Students__c = totalStudents;
            session.Present_Count__c = presentCount;
            session.Absent_Count__c = absentCount;
            
            // Map to existing String fields requested by user
            session.Number_Of_Present__c = String.valueOf(presentCount);
            session.Number_Of_Absent__c = String.valueOf(absentCount);
            session.Number_Of_Present__c = String.valueOf(presentCount);
            session.Number_Of_Absent__c = String.valueOf(absentCount);
            
            if (String.isNotBlank(teacherId)) {
                // Smart Lookup Handler: Handle target mismatch (Account vs Contact vs User)
                Schema.DescribeFieldResult dr = Attendance_Session__c.Attendance_Taken_By__c.getDescribe();
                String targetObj = dr.getReferenceTo()[0].getDescribe().getName();
                
                Id tId = (Id)teacherId;
                String sourceObj = tId.getSObjectType().getDescribe().getName();
                
                if (targetObj == sourceObj) {
                    session.Attendance_Taken_By__c = teacherId;
                } else if (targetObj == 'Contact' && sourceObj == 'Account') {
                    // Account -> Contact conversion (Person Account)
                    List<Account> accs = [SELECT PersonContactId FROM Account WHERE Id = :teacherId LIMIT 1];
                    if (!accs.isEmpty()) {
                        session.Attendance_Taken_By__c = accs[0].PersonContactId;
                    }
                } else if (targetObj == 'User') {
                    // Account/Contact -> User conversion
                    // Attempt to find a User matching the Account/Contact (e.g. by Name or FederationId)
                    // For now, let's try current user if it's a save attempt by someone
                    session.Attendance_Taken_By__c = UserInfo.getUserId();
                } else {
                    // Fallback to avoid crash
                    session.Attendance_Taken_By__c = null;
                }
            }
            
            upsert session;
            
            // 2. Manage Attendance Records (Exception based)
            
            // Fetch Roll Numbers for Absent Students
            Map<Id, Account> absentStudentsMap = new Map<Id, Account>();
            if (!absentStudentIds.isEmpty()) {
                absentStudentsMap = new Map<Id, Account>([SELECT Id, Roll_No__c FROM Account WHERE Id IN :absentStudentIds]);
            }

            // Get existing attendance records for this session
            List<Attendance__c> existingRecords = [SELECT Id, Student__c FROM Attendance__c 
                                                   WHERE Attendance_Session__c = :session.Id];
            
            Set<String> existingAbsentIds = new Set<String>();
            List<Attendance__c> toDelete = new List<Attendance__c>();
            
            for(Attendance__c att : existingRecords) {
                if(!absentStudentIds.contains(att.Student__c)) {
                    // Student is now Present, but was previously Absent -> Delete record
                    toDelete.add(att);
                } else {
                    existingAbsentIds.add(att.Student__c);
                }
            }
            
            if(!toDelete.isEmpty()) {
                delete toDelete;
            }
            
            List<Attendance__c> toInsert = new List<Attendance__c>();
            for(String studentId : absentStudentIds) {
                if(!existingAbsentIds.contains(studentId)) {
                    // New Absentee
                    Attendance__c newAtt = new Attendance__c(
                        Student__c = studentId,
                        Class__c = classVal,
                        Section__c = sectionVal,
                        Date__c = attendanceDate,
                        Attendance_Session__c = session.Id,
                        Attendance_Status__c = 'Absent'
                    );
                    
                    // Populate Roll Number
                    if (absentStudentsMap.containsKey(studentId)) {
                        newAtt.Roll_No__c = absentStudentsMap.get(studentId).Roll_No__c;
                    }
                    
                    toInsert.add(newAtt);
                }
            }
            
            if(!toInsert.isEmpty()) {
                insert toInsert;
            }
            
            return getSessionData(classVal, sectionVal, attendanceDate);
            
        } catch (Exception e) {
            Database.rollback(sp);
            throw new AuraHandledException('Error saving attendance: ' + e.getMessage());
        }
    }
}