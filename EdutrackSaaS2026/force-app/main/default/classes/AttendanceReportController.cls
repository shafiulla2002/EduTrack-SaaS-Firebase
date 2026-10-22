public with sharing class AttendanceReportController {
  
    
    
    @AuraEnabled 
    public static List<StudentWrapper> getStudents() {
        try {
            List<StudentWrapper> studentList = new List<StudentWrapper>();
            
            List<Account> students = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [
                SELECT Id, Name, Roll_No__c, Section__c, Class__c, Class__r.Name
                FROM Account
                WHERE (Type = 'Student' OR Class__c != null)
                ORDER BY Section__c, Roll_No__c
                LIMIT 2000
            ]).getRecords();
            
            for(Account student : students) {
                StudentWrapper wrapper = new StudentWrapper();
                wrapper.id = student.Id;
                wrapper.name = student.Name;
                wrapper.rollNo = (String)NamespaceUtils.getValue(student, 'Roll_No__c');
                wrapper.section = (String)NamespaceUtils.getValue(student, 'Section__c');
                wrapper.classValue = (String)NamespaceUtils.getValue(student, 'Class__c');
                wrapper.className = (String)NamespaceUtils.getValue(student, 'Class__r.Name'); 
                if (wrapper.className == null) wrapper.className = '';                
                studentList.add(wrapper);
            }
            
            return studentList;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching students: ' + e.getMessage());
        }
    }
    
  
    @AuraEnabled
    public static List<AttendanceWrapper> getAttendanceRecords(Date startDate, Date endDate) {
        try {
            List<AttendanceWrapper> attendanceList = new List<AttendanceWrapper>();
            
            List<Attendance__c> attendances = (List<Attendance__c>)Security.stripInaccessible(AccessType.READABLE, [
                SELECT Id, Student__c, Student__r.Name, Roll_No__c, Section__c, 
                       Class__c, Date__c, Attendance_Status__c,
                       Student__r.Roll_No__c, Student__r.Section__c, Student__r.Class__c
                FROM Attendance__c
                WHERE Date__c >= :startDate 
                AND Date__c <= :endDate
                ORDER BY Date__c DESC, Section__c, Roll_No__c
                LIMIT 5000
            ]).getRecords();
            
            for(Attendance__c attendance : attendances) {
                AttendanceWrapper wrapper = new AttendanceWrapper();
                wrapper.id = attendance.Id;
                wrapper.studentId = (String)NamespaceUtils.getValue(attendance, 'Student__c');
                String studentName = (String)NamespaceUtils.getValue(attendance, 'Student__r.Name');
                wrapper.studentName = studentName != null ? studentName : 'Unknown';
                
                String attRoll = (String)NamespaceUtils.getValue(attendance, 'Roll_No__c');
                String stdRoll = attendance.Student__r != null ? (String)NamespaceUtils.getValue(attendance.Student__r, 'Roll_No__c') : null;
                wrapper.rollNo = attRoll != null ? attRoll : stdRoll;
                
                String attSec = (String)NamespaceUtils.getValue(attendance, 'Section__c');
                String stdSec = attendance.Student__r != null ? (String)NamespaceUtils.getValue(attendance.Student__r, 'Section__c') : null;
                wrapper.section = attSec != null ? attSec : stdSec;
                
                String attCls = (String)NamespaceUtils.getValue(attendance, 'Class__c');
                String stdCls = attendance.Student__r != null ? (String)NamespaceUtils.getValue(attendance.Student__r, 'Class__c') : null;
                wrapper.classValue = attCls != null ? attCls : stdCls;
                
                wrapper.className = stdCls; 
                wrapper.attendanceDate = attendance.Date__c;
                wrapper.status = (String)NamespaceUtils.getValue(attendance, 'Attendance_Status__c');
                
                attendanceList.add(wrapper);
            }
            
            return attendanceList;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching attendance records: ' + e.getMessage());
        }
    }
    
    
    @AuraEnabled
public static List<String> getClasses() {
    try {
        Set<String> classSet = new Set<String>();

        // Fetch from related Class Object via lookup
        List<Account> accs = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [
            SELECT Class__r.Name 
            FROM Account 
            WHERE Class__c != null
            LIMIT 1000
        ]).getRecords();
        for(Account acc : accs) {
            String clsName = (String)NamespaceUtils.getValue(acc, 'Class__r.Name');
            if(clsName != null) {
                classSet.add(clsName);
            }
        }

        List<String> classList = new List<String>(classSet);
        classList.sort();
        return classList;

    } catch (Exception e) {
        throw new AuraHandledException('Error fetching classes: ' + e.getMessage());
    }
}
    @AuraEnabled
public static List<String> getSections() {
    try {
        Set<String> sectionSet = new Set<String>();

        // Fetch from related Section Object via lookup
        List<Account> accs = (List<Account>)Security.stripInaccessible(AccessType.READABLE, [
            SELECT Section__r.Name 
            FROM Account 
            WHERE Section__c != null
            LIMIT 1000
        ]).getRecords();
        for(Account acc : accs) {
            String secName = (String)NamespaceUtils.getValue(acc, 'Section__r.Name');
            if(secName != null) {
                sectionSet.add(secName);
            }
        }

        List<String> sectionList = new List<String>(sectionSet);
        sectionList.sort();
        return sectionList;

    } catch (Exception e) {
        throw new AuraHandledException('Error fetching sections: ' + e.getMessage());
    }
}
    
    @AuraEnabled
    public static List<AttendanceSessionWrapper> getAttendanceSessions(Date startDate, Date endDate) {
        try {
            List<AttendanceSessionWrapper> sessionList = new List<AttendanceSessionWrapper>();
            
            List<Attendance_Session__c> sessions = (List<Attendance_Session__c>)Security.stripInaccessible(AccessType.READABLE, [
                SELECT Id, Class__c, Class__r.Name, Date__c, Section__c,
                       Total_Students__c, Present_Count__c, Absent_Count__c,
                       Number_Of_Present__c, Number_Of_Absent__c
                FROM Attendance_Session__c
                WHERE Date__c >= :startDate 
                AND Date__c <= :endDate
                ORDER BY Date__c DESC
                LIMIT 1000
            ]).getRecords();
            
            for(Attendance_Session__c session : sessions) {
                AttendanceSessionWrapper wrapper = new AttendanceSessionWrapper();
                wrapper.id = session.Id;
                wrapper.classId = session.Class__c;
                wrapper.className = session.Class__r != null ? session.Class__r.Name : '';
                wrapper.attendanceDate = session.Date__c;
                wrapper.section = session.Section__c;
                wrapper.totalStudents = Integer.valueOf(session.Total_Students__c != null ? session.Total_Students__c : 0);
                wrapper.presentCount = Integer.valueOf(session.Present_Count__c != null ? session.Present_Count__c : 0);
                wrapper.absentCount = Integer.valueOf(session.Absent_Count__c != null ? session.Absent_Count__c : 0);
                
                sessionList.add(wrapper);
            }
            
            return sessionList;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching attendance sessions: ' + e.getMessage());
        }
    }
    
    
    @AuraEnabled
    public static AttendanceDataWrapper getAttendanceData(Date startDate, Date endDate) {
        try {
            AttendanceDataWrapper dataWrapper = new AttendanceDataWrapper();
            dataWrapper.students = getStudents();
            dataWrapper.attendanceRecords = getAttendanceRecords(startDate, endDate);
            dataWrapper.classes = getClasses();
            dataWrapper.sections = getSections();
            dataWrapper.sessions = getAttendanceSessions(startDate, endDate);
            dataWrapper.debugStats = getDebugData();
            
            return dataWrapper;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching attendance data: ' + e.getMessage());
        }
    }
    
    // Wrapper Classes
    
    public class StudentWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String rollNo;
        @AuraEnabled public String section;
        @AuraEnabled public String classValue;
        @AuraEnabled public String className;
    }
    
    public class AttendanceWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String studentId;
        @AuraEnabled public String studentName;
        @AuraEnabled public String rollNo;
        @AuraEnabled public String section;
        @AuraEnabled public String classValue;
        @AuraEnabled public String className; // Added for name matching
        @AuraEnabled public Date attendanceDate;
        @AuraEnabled public String status; // Present or Absent
    }
    
    public class AttendanceSessionWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String classId;
        @AuraEnabled public String className;
        @AuraEnabled public Date attendanceDate;
        @AuraEnabled public String section;
        @AuraEnabled public Integer totalStudents;
        @AuraEnabled public Integer presentCount;
        @AuraEnabled public Integer absentCount;
    }
    
    public class AttendanceDataWrapper {
        @AuraEnabled public List<StudentWrapper> students;
        @AuraEnabled public List<AttendanceWrapper> attendanceRecords;
        @AuraEnabled public List<String> classes;
        @AuraEnabled public List<String> sections;
        @AuraEnabled public List<AttendanceSessionWrapper> sessions;
        @AuraEnabled public String debugStats; // Added for debugging
    }

    @AuraEnabled
    public static String getDebugData() {
        try {
            Integer total = [SELECT Count() FROM Account WITH SECURITY_ENFORCED];
            Integer person = [SELECT Count() FROM Account WHERE IsPersonAccount = true WITH SECURITY_ENFORCED];
            Integer student = [SELECT Count() FROM Account WHERE Type = 'Student' WITH SECURITY_ENFORCED];
            Integer withClass = [SELECT Count() FROM Account WHERE Class__c != null WITH SECURITY_ENFORCED];
            Integer combined = [SELECT Count() FROM Account WHERE (Type = 'Student' OR Class__c != null) WITH SECURITY_ENFORCED];
            
            return 'Total Acc: ' + total + ' | Person: ' + person + ' | Type=Student: ' + student + ' | Class!=null: ' + withClass + ' | Match: ' + combined;
        } catch(Exception e) {
            return 'Error: ' + e.getMessage();
        }
    }
    
    
}





