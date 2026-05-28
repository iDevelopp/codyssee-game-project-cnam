using System;
using UnityEngine;

public class NPC : MonoBehaviour, IInteractable
{
    [Serializable]
    public class DialogueChoice
    {
        public string optionText;
        [TextArea(2, 5)] public string response;
    }

    [SerializeField] private string npcName = "PNJ";
    [SerializeField] private Sprite portrait;
    [SerializeField, TextArea(2, 5)] private string[] dialogueLines = { "Bonjour, aventurier !" };
    [SerializeField] private DialogueChoice[] choices;

    private enum State { Idle, ShowingLines, ShowingChoices, ShowingResponse }
    private State state = State.Idle;
    private int currentLine;

    public bool CanInteract() => state != State.ShowingChoices;

    public void Interactable()
    {
        if (state != State.Idle && DialogueBox.Instance.CurrentOwner != (object)this)
        {
            state = State.Idle;
        }

        switch (state)
        {
            case State.Idle:
                StartDialogue();
                break;
            case State.ShowingLines:
                AdvanceLine();
                break;
            case State.ShowingResponse:
                EndDialogue();
                break;
        }
    }

    private void StartDialogue()
    {
        if (dialogueLines.Length == 0) return;
        currentLine = 0;
        state = State.ShowingLines;
        DialogueBox.Instance.Show(npcName, dialogueLines[currentLine], portrait, this);
    }

    private void AdvanceLine()
    {
        if (currentLine < dialogueLines.Length - 1)
        {
            currentLine++;
            DialogueBox.Instance.Show(npcName, dialogueLines[currentLine], portrait, this);
            return;
        }

        if (choices != null && choices.Length > 0)
        {
            PresentChoices();
        }
        else
        {
            EndDialogue();
        }
    }

    private void PresentChoices()
    {
        state = State.ShowingChoices;
        string[] options = new string[choices.Length];
        for (int i = 0; i < choices.Length; i++) options[i] = choices[i].optionText;
        DialogueBox.Instance.ShowChoices(npcName, dialogueLines[currentLine], options, OnChoicePicked, portrait, this);
    }

    private void OnChoicePicked(int index)
    {
        state = State.ShowingResponse;
        DialogueBox.Instance.Show(npcName, choices[index].response, portrait, this);
    }

    private void EndDialogue()
    {
        DialogueBox.Instance.Hide();
        state = State.Idle;
        currentLine = 0;
    }
}
