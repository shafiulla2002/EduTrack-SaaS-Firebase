@isTest
public class NamespaceUtilsTest {
    
    @isTest
    static void testStripNamespaceNull() {
        System.assertEquals(null, NamespaceUtils.stripNamespace(null));
        System.assertEquals(null, NamespaceUtils.stripNamespaceList(null));
    }
    
    @isTest
    static void testStripNamespace() {
        Account acc = new Account(Name='Test Account');
        Map<String, Object> result = NamespaceUtils.stripNamespace(acc);
        System.assertEquals('Test Account', (String)result.get('Name'));
    }
    
    @isTest
    static void testStripNamespaceWithId() {
        Account acc = new Account(Name='Test Account', Id='001000000000001AAA');
        Map<String, Object> result = NamespaceUtils.stripNamespace(acc);
        System.assertEquals('Test Account', (String)result.get('Name'));
        System.assertEquals(acc.Id, (Id)result.get('Id'));
    }
    
    @isTest
    static void testStripNamespaceList() {
        Account acc1 = new Account(Name='Account 1');
        Account acc2 = new Account(Name='Account 2');
        List<Map<String, Object>> listResult = NamespaceUtils.stripNamespaceList(new List<Account>{acc1, acc2});
        System.assertEquals(2, listResult.size());
        System.assertEquals('Account 1', (String)listResult[0].get('Name'));
        System.assertEquals('Account 2', (String)listResult[1].get('Name'));
    }
    
    @isTest
    static void testStripNamespaceWithParentLookup() {
        Account acc = new Account(Name='Parent Account', Id='001000000000001AAA');
        Contact con = new Contact(LastName='Child Contact', AccountId=acc.Id);
        con.Account = acc; 
        
        Map<String, Object> result = NamespaceUtils.stripNamespace(con);
        System.assertEquals('Child Contact', (String)result.get('LastName'));
        
        Map<String, Object> accountResult = (Map<String, Object>)result.get('Account');
        System.assertNotEquals(null, accountResult);
        System.assertEquals('Parent Account', (String)accountResult.get('Name'));
    }
    
    @isTest
    static void testStripNamespaceWithChildren() {
        String jsonStr = '{"attributes":{"type":"Account"}, "Name":"Parent Account", "Contacts":{"totalSize":1, "done":true, "records":[{"attributes":{"type":"Contact"}, "LastName":"Child Contact"}]}}';
        Account accWithChildren = (Account)JSON.deserialize(jsonStr, Account.class);
        
        Map<String, Object> result = NamespaceUtils.stripNamespace(accWithChildren);
        System.assertEquals('Parent Account', (String)result.get('Name'));
        
        List<Object> contactsResult = (List<Object>)result.get('Contacts');
        System.assertNotEquals(null, contactsResult);
        System.assertEquals(1, contactsResult.size());
        
        Map<String, Object> contactMap = (Map<String, Object>)contactsResult[0];
        System.assertEquals('Child Contact', (String)contactMap.get('LastName'));
    }
    
    @isTest
    static void testGetVFPageUrl() {
        String urlNoParams = NamespaceUtils.getVFPageUrl('AttendanceInvoice', null);
        System.assert(urlNoParams.contains('AttendanceInvoice'));
        System.assert(urlNoParams.startsWith('/apex/'));
        
        String urlWithParams = NamespaceUtils.getVFPageUrl('AdmissionInvoice', 'id=XXX&preview=true');
        System.assert(urlWithParams.contains('AdmissionInvoice'));
        System.assert(urlWithParams.contains('id=XXX'));
        System.assert(urlWithParams.contains('preview=true'));
        System.assert(urlWithParams.contains('?'));
    }
}