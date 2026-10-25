"""Synthetic scoring/coverage regression; no model or user data required."""
import copy
import json
import unittest

from evaluate_adapter import score_output, select_cases, stop_token_ids


def row(name='record_rejection', args=None, family='restore', ident='1'):
    args = {'itemId': 'synthetic:2', 'reason': '误排除', 'restore': True} if args is None else args
    return {'id': ident, 'family': family,
            'messages': [{'role': 'assistant', 'tool_calls': [{'function': {'name': name, 'arguments': json.dumps(args)}}]}],
            'tools': [{'function': {'name': name, 'parameters': {'properties': {
                'itemId': {'type': 'string'}, 'reason': {'type': 'string'}, 'restore': {'type': 'boolean'}}}}}]}


VALID = '<tool_call>\n<function=record_rejection>\n<parameter=itemId>synthetic:2</parameter>\n<parameter=reason>误排除</parameter>\n<parameter=restore>True</parameter>\n</function>\n</tool_call>'


class EvaluationTests(unittest.TestCase):
    def test_chat_stop_differs_from_model_eos(self):
        class Tokenizer:
            eos_token_id = 248046
            def convert_tokens_to_ids(self, text):
                return 248046
            def convert_ids_to_tokens(self, value):
                return '<|im_end|>'
        self.assertEqual(stop_token_ids(Tokenizer(), 248044), [248044, 248046])

    def test_fake_next_turn_cannot_pass_even_when_first_tool_matches(self):
        result = score_output(VALID + '<|im_end|>\n<|im_start|>user\n任务完成', row())
        self.assertFalse(result['exactToolMatch'])
        self.assertTrue(result['roleBoundaryViolation'])

    def test_official_xml_boolean_and_string(self):
        self.assertTrue(score_output(VALID, row())['exactToolMatch'])

    def test_wrong_id_wrong_restore_duplicate_and_broken_block(self):
        for invalid in [VALID.replace('synthetic:2', 'synthetic:9'), VALID.replace('True', 'False'),
                        VALID.replace('</function>', '<parameter=restore>True</parameter></function>'),
                        VALID + '<tool_call>', VALID.replace('</parameter>', '', 1),
                        VALID.replace('True', '1')]:
            with self.subTest(invalid=invalid):
                self.assertFalse(score_output(invalid, row())['exactToolMatch'])

    def test_text_never_automatically_scored_as_success(self):
        text_row = row()
        text_row['messages'] = [{'role': 'assistant', 'content': '先核实'}]
        result = score_output('已经找到了', text_row)
        self.assertIsNone(result['exactToolMatch'])
        self.assertTrue(result['manualReviewRequired'])
        self.assertTrue(score_output(VALID, text_row)['unexpectedToolCall'])

    def test_coverage_selects_rare_restore_and_families(self):
        rows = [row(args={'itemId': 'synthetic:2', 'reason': '排除'}, family='reject', ident=str(i)) for i in range(20)]
        rows.append(row(ident='restore'))
        rows.append(row(name='get_search_task', args={}, family='search', ident='search'))
        selected = select_cases(rows, 14)
        self.assertEqual(len(selected), 14)
        self.assertEqual(len({r['id'] for r in selected}), 14)
        self.assertIn('restore', [r['id'] for r in selected])
        self.assertEqual(selected, select_cases(copy.deepcopy(rows), 14))


if __name__ == '__main__':
    unittest.main()
