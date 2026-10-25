import json
import unittest
from tool_protocol import assistant_message

TOOLS=[{'function':{'name':'record_rejection','parameters':{'properties':{'restore':{'type':'boolean'},'itemId':{'type':'string'}}}}}]
CALL='<tool_call><function=record_rejection><parameter=itemId>item:7</parameter><parameter=restore>True</parameter></function></tool_call>'


class ProtocolTests(unittest.TestCase):
    def test_boolean_and_record_id_preserved(self):
        m=assistant_message(CALL,TOOLS)
        self.assertEqual(json.loads(m['tool_calls'][0]['function']['arguments']),{'itemId':'item:7','restore':True})

    def test_unknown_tool_and_field_not_silently_repaired(self):
        m=assistant_message(CALL.replace('record_rejection','unknown_tool').replace('restore','unknown_field'),TOOLS)
        self.assertEqual(m['tool_calls'][0]['function']['name'],'unknown_tool')
        self.assertIn('unknown_field',json.loads(m['tool_calls'][0]['function']['arguments']))

    def test_malformed_duplicate_cross_turn_and_fake_result_rejected(self):
        for text in [CALL+'已成功归还',CALL+'<|im_start|>user',CALL+'<tool_call>',
                     CALL.replace('</function>','<parameter=itemId>item:8</parameter></function>'),
                     CALL.replace('True','1')]:
            with self.subTest(text=text):
                with self.assertRaises(ValueError):assistant_message(text,TOOLS)

    def test_reasoning_removed_from_public_content(self):
        self.assertEqual(assistant_message('<think>内部文本</think>请核对候选。',TOOLS)['content'],'请核对候选。')


if __name__=='__main__':unittest.main()
