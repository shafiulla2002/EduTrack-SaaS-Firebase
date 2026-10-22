public without sharing class AttendanceReportController {
  
    
    
    @AuraEnabled(cacheable=true) 
    public static List<StudentWrapper> getStudents() {
        try {
            List<StudentWrapper> studentList = new List<StudentWrapper>();
            
            for(Account student : [
                SELECT Id, Name, Roll_No__c, Section__c, Class__c
                FROM Account
                WHERE (Type = 'Student' OR Class__c != null)
                ORDER BY Section__c, Roll_No__c
            ]) {
                StudentWrapper wrapper = new StudentWrapper();
                wrapper.id = student.Id;
                wrapper.name = student.Name;
                wrapper.rollNo = student.Roll_No__c;
                wrapper.section = student.Section__c;
                wrapper.classValue = student.Class__c;
                wrapper.className = student.Class__c; 
                
                studentList.add(wrapper);
            }
            
            return studentList;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching students: ' + e.getMessage());
        }
    }
    
  
    @AuraEnabled(cacheable=true)
    public static List<AttendanceWrapper> getAttendanceRecords(Date startDate, Date endDate) {
        try {
            List<AttendanceWrapper> attendanceList = new List<AttendanceWrapper>();
            
            for(Attendance__c attendance : [
                SELECT Id, Student__c, Student__r.Name, Roll_No__c, Section__c, 
                       Class__c, Date__c, Attendance_Status__c,
                       Student__r.Roll_No__c, Student__r.Section__c, Student__r.Class__c
                FROM Attendance__c
                WHERE Date__c >= :startDate 
                AND Date__c <= :endDate
                ORDER BY Date__c DESC, Section__c, Roll_No__c
            ]) {
                AttendanceWrapper wrapper = new AttendanceWrapper();
                wrapper.id = attendance.Id;
                wrapper.studentId = attendance.Student__c;
                wrapper.studentName = attendance.Student__r.Name;
                wrapper.rollNo = attendance.Roll_No__c != null ? attendance.Roll_No__c : attendance.Student__r.Roll_No__c;
                wrapper.section = attendance.Section__c != null ? attendance.Section__c : attendance.Student__r.Section__c;
                wrapper.classValue = attendance.Class__c != null ? attendance.Class__c : attendance.Student__r.Class__c;
                wrapper.className = attendance.Student__r.Class__c; 
                wrapper.attendanceDate = attendance.Date__c;
                wrapper.status = attendance.Attendance_Status__c;
                
                attendanceList.add(wrapper);
            }
            
            return attendanceList;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching attendance records: ' + e.getMessage());
        }
    }
    
   
   @AuraEnabled(cacheable=true)
public static List<String> getClasses() {
    try {
        Set<String> classSet = new Set<String>();

        // Fetch from related Class Object via lookup
        for(Account acc : [
            SELECT Class__r.Name 
            FROM Account 
            WHERE Class__c != null
            LIMIT 20000
        ]) {
            if(acc.Class__r != null) {
                classSet.add(acc.Class__r.Name);
            }
        }

        List<String> classList = new List<String>(classSet);
        classList.sort();
        return classList;

    } catch (Exception e) {
        throw new AuraHandledException('Error fetching classes: ' + e.getMessage());
    }
}
    @AuraEnabled(cacheable=true)
public static List<String> getSections() {
    try {
        Set<String> sectionSet = new Set<String>();

        // Fetch from related Section Object via lookup
        for(Account acc : [
            SELECT Section__r.Name 
            FROM Account 
            WHERE Section__c != null
            LIMIT 20000
        ]) {
            if(acc.Section__r != null) {
                sectionSet.add(acc.Section__r.Name);
            }
        }

        List<String> sectionList = new List<String>(sectionSet);
        sectionList.sort();
        return sectionList;

    } catch (Exception e) {
        throw new AuraHandledException('Error fetching sections: ' + e.getMessage());
    }
}
    
    @AuraEnabled(cacheable=true)
    public static List<AttendanceSessionWrapper> getAttendanceSessions(Date startDate, Date endDate) {
        try {
            List<AttendanceSessionWrapper> sessionList = new List<AttendanceSessionWrapper>();
            
            for(Attendance_Session__c session : [
                SELECT Id, Class__c, Class__r.Name, Date__c, Section__c,
                       Total_Students__c, Present_Count__c, Absent_Count__c,
                       Number_Of_Present__c, Number_Of_Absent__c
                FROM Attendance_Session__c
                WHERE Date__c >= :startDate 
                AND Date__c <= :endDate
                ORDER BY Date__c DESC
            ]) {
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
    
    
    @AuraEnabled(cacheable=true)
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

    @AuraEnabled(cacheable=true)
    public static String getDebugData() {
        try {
            Integer total = [SELECT Count() FROM Account];
            Integer person = [SELECT Count() FROM Account WHERE IsPersonAccount = true];
            Integer student = [SELECT Count() FROM Account WHERE Type = 'Student'];
            Integer withClass = [SELECT Count() FROM Account WHERE Class__c != null];
            Integer combined = [SELECT Count() FROM Account WHERE (Type = 'Student' OR Class__c != null)];
            
            return 'Total Acc: ' + total + ' | Person: ' + person + ' | Type=Student: ' + student + ' | Class!=null: ' + withClass + ' | Match: ' + combined;
        } catch(Exception e) {
            return 'Error: ' + e.getMessage();
        }
    }
    
    
}