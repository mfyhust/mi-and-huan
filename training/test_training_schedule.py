import unittest
from train_lora import training_schedule, choose_compute_dtype, validation_subset


class ScheduleTests(unittest.TestCase):
    def test_validation_covers_rare_actions_not_just_initial_searches(self):
        rows=[{'family':f,'targetKinds':['search_found_items'],'group':f} for f in ['search','restore','ambiguous']]
        rows += [{'family':'restore','targetKinds':['record_rejection:restore'],'group':'restore'},
                 {'family':'ambiguous','targetKinds':['ask_clarifying_question'],'group':'ambiguous'},
                 {'family':'search','targetKinds':['text'],'group':'search'}]
        selected=validation_subset(rows)
        self.assertEqual({k for e in selected for k in e['targetKinds']},
                         {'search_found_items','record_rejection:restore','ask_clarifying_question','text'})
        self.assertEqual({e['family'] for e in selected},{'search','restore','ambiguous'})

    def test_bf16_emulation_does_not_select_bf16(self):
        from types import SimpleNamespace
        def supported(including_emulation=True):
            return including_emulation
        fake=SimpleNamespace(cuda=SimpleNamespace(is_bf16_supported=supported),bfloat16='bf16',float16='fp16')
        self.assertEqual(choose_compute_dtype(fake),'fp16')

    def test_native_bf16_remains_selected(self):
        from types import SimpleNamespace
        fake=SimpleNamespace(cuda=SimpleNamespace(is_bf16_supported=lambda including_emulation:True),bfloat16='bf16',float16='fp16')
        self.assertEqual(choose_compute_dtype(fake),'bf16')

    def setUp(self):
        self.rows=[{'family':'search','targetKinds':['text'],'group':str(i)} for i in range(100)]
        self.rows += [{'family':'restore','targetKinds':['record_rejection:restore'],'group':'rare'}]

    def test_balanced_keeps_rare_action_and_both_buckets(self):
        schedule=training_schedule(self.rows,10,True)
        self.assertEqual(sum(e['group']=='rare' for e in schedule),5)
        self.assertEqual(schedule,training_schedule(self.rows,10,True))
        self.assertEqual(len(self.rows),101)

    def test_balanced_refuses_incomplete_coverage(self):
        with self.assertRaises(ValueError):training_schedule(self.rows,1,True)

    def test_default_preserves_previous_seeded_shuffle(self):
        import random
        before=self.rows.copy();random.Random(42).shuffle(before)
        self.assertEqual(training_schedule(self.rows,10),before[:10])


if __name__=='__main__':unittest.main()
