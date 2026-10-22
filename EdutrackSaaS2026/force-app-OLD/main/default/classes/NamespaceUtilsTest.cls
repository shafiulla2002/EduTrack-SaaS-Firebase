@isTest
public class NamespaceUtilsTest {

    @isTest
    static void testStripNamespace_AllCases() {

        // Create test data
        Account acc = new Account(Name='Test Account');
        insert acc;

        // Call method
        Test.startTest();
        Map<String, Object> result = NamespaceUtils.stripNamespace(acc);
        Test.stopTest();

        // Basic assertion
        System.assertEquals('Test Account', result.get('Name'));
        System.assert(result.containsKey('Id'));

        // Test list method
        List<Map<String, Object>> listResult =
            NamespaceUtils.stripNamespaceList(new List<Account>{acc});

        System.assertEquals(1, listResult.size());
        System.assertEquals('Test Account', listResult[0].get('Name'));
    }

    /* ========================================
       TEST: NULL HANDLING
    ======================================== */
    @isTest
    static void testNullInputs() {

        Test.startTest();
        Map<String, Object> res1 = NamespaceUtils.stripNamespace(null);
        List<Map<String, Object>> res2 = NamespaceUtils.stripNamespaceList(null);
        Test.stopTest();

        System.assertEquals(null, res1);
        System.assertEquals(null, res2);
    }

    /* ========================================
       TEST: NESTED SOBJECT HANDLING
    ======================================== */
    @isTest
    static void testNestedSObject() {

        Account acc = new Account(Name='Parent');
        insert acc;

        Contact con = new Contact(LastName='Child', AccountId=acc.Id);
        insert con;

        // Query with relationship
        Contact conWithAcc = [
            SELECT Id, LastName, Account.Name
            FROM Contact
            WHERE Id = :con.Id
        ];

        Test.startTest();
        Map<String, Object> result = NamespaceUtils.stripNamespace(conWithAcc);
        Test.stopTest();

        System.assert(result.containsKey('Account'));
    }

    /* ========================================
       TEST: LIST OF CHILD RECORDS
    ======================================== */
    @isTest
    static void testChildListHandling() {

        Account acc = new Account(Name='Parent Acc');
        insert acc;

        Contact c1 = new Contact(LastName='C1', AccountId=acc.Id);
        Contact c2 = new Contact(LastName='C2', AccountId=acc.Id);
        insert new List<Contact>{c1, c2};

        // Query with child relationship
        Account accWithContacts = [
            SELECT Id, Name, (SELECT Id, LastName FROM Contacts)
            FROM Account
            WHERE Id = :acc.Id
        ];

        Test.startTest();
        Map<String, Object> result = NamespaceUtils.stripNamespace(accWithContacts);
        Test.stopTest();

        System.assert(result.containsKey('Contacts'));
    }

    /* ========================================
       TEST: getVFPageUrl
    ======================================== */
    @isTest
    static void testGetVFPageUrl() {

        Test.startTest();
        String url1 = NamespaceUtils.getVFPageUrl('TestPage', null);
        String url2 = NamespaceUtils.getVFPageUrl('TestPage', 'id=123');
        Test.stopTest();

        System.assert(url1.contains('/apex/'));
        System.assert(url1.contains('TestPage'));

        System.assert(url2.contains('?id=123'));
    }
}