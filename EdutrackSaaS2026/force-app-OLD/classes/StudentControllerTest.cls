@isTest
public class StudentControllerTest {

    @testSetup
    static void setup() {

        // Academic Year
        Academic_Year__c ay = new Academic_Year__c(
            Name='2024-2025',
            Is_Active__c=true,
            Start_Date__c=Date.today().addDays(-30),
            End_Date__c=Date.today().addDays(30)
        );
        insert ay;

        // Create Class
        Class__c cls = new Class__c(Name='Class-1');
        insert cls;

        // Create Section
        Section__c sec = new Section__c(Name='A');
        insert sec;

        // Person Account Record Type
        Id personRtId = [SELECT Id FROM RecordType 
                         WHERE SObjectType='Account' 
                         AND IsPersonType=true 
                         LIMIT 1].Id;

        // Student
        Account student = new Account(
            FirstName='Test',
            LastName='Student',
            RecordTypeId=personRtId,
            Type='Student',
            Class__c=cls.Id,
            Section__c=sec.Id,
            Roll_No__c='1'
        );
        insert student;

        // Opportunity
        Opportunity opp = new Opportunity(
            Name='Test Opp',
            AccountId=student.Id,
            StageName='Prospecting',
            CloseDate=Date.today(),
            Academic_Year__c=ay.Id
        );
        insert opp;

        // Product
        Product2 p = new Product2(Name='Fee', IsActive=true);
        insert p;

        Id stdPbId = Test.getStandardPricebookId();

        PricebookEntry pbe = new PricebookEntry(
            Pricebook2Id=stdPbId,
            Product2Id=p.Id,
            UnitPrice=100,
            IsActive=true
        );
        insert pbe;

        insert new OpportunityLineItem(
            OpportunityId=opp.Id,
            PricebookEntryId=pbe.Id,
            Quantity=1,
            UnitPrice=100
        );

        // Invoice
        Invoice__c inv = new Invoice__c(
            Student__c=student.Id,
            Opportunity__c=opp.Id,
            Status__c='Paid'
        );
        insert inv;

        insert new Invoice_Item__c(
            Invoice__c=inv.Id,
            Amount__c=100
        );

        // Attendance
        Attendance_Session__c sess = new Attendance_Session__c(
            Class__c=cls.Id,
            Section__c=sec.Id,
            Date__c=Date.today()
        );
        insert sess;

        insert new Attendance__c(
            Student__c=student.Id,
            Attendance_Session__c=sess.Id,
            Attendance_Status__c='Absent',
            Date__c=Date.today()
        );

        // Case
        insert new Case(
            AccountId=student.Id,
            Subject='Test Case',
            Status='New'
        );
    }

    @isTest
    static void testAllMethods() {

        Academic_Year__c ay = [SELECT Id FROM Academic_Year__c LIMIT 1];
        Account student = [SELECT Id FROM Account LIMIT 1];

        Test.startTest();

        // searchStudents
        StudentController.searchStudents(
            'Test',
            ay.Id,
            'Class-1',
            'A'
        );

        StudentController.searchStudents(
            'Nomatch',
            ay.Id,
            'Class-1',
            'A'
        );

        StudentController.searchStudents(
            '',
            '',
            '',
            ''
        );

        // getClassOptions
        StudentController.getClassOptions();

        // getSectionOptions
        StudentController.getSectionOptions();

        // getStudentDetails
        StudentController.getStudentDetails(student.Id);

        // getAcademicYearOptions
        StudentController.getAcademicYearOptions();

        // applyDiscount
        StudentController.applyDiscount(student.Id, ay.Id, 10);

        try {
            StudentController.applyDiscount(null, ay.Id, 10);
        } catch (Exception e) {}

        // getCandidatesByBatch
        StudentController.getCandidatesByBatch(
            '2024-2025',
            'Class-1',
            'A'
        );

        Test.stopTest();
    }
}