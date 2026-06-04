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

    [Serializable]
    public class Question
    {
        public CardData expectedAnswer;
        [TextArea(2, 5)] public string thanksLine = "Exactement, merci de ton aide !";
        [TextArea(2, 5)] public string hintLine = "Hmm, ce n'est pas la bonne carte. Réessaie...";
    }

    [SerializeField] private string npcName = "PNJ";
    [SerializeField] private Sprite portrait;
    [SerializeField, TextArea(2, 5)] private string[] dialogueLines = { "Bonjour, aventurier !" };
    [SerializeField, TextArea(2, 5)] private string[] resolvedLines = { "Merci encore pour ton aide, tout refonctionne !" };
    [SerializeField] private DialogueChoice[] choices;
    [SerializeField] private Question question;
    [SerializeField] private CardDatabase cardDatabase;

    public event Action<NPC> OnQuestionResolved;
    public bool IsResolved { get; private set; }

    private enum State { Idle, ShowingLines, ShowingChoices, ShowingResponse, AwaitingAnswer }
    private State state = State.Idle;
    private int currentLine;
    private Deck cachedPlayerDeck;

    public bool CanInteract() => state != State.ShowingChoices && state != State.AwaitingAnswer;

    // La carte-réponse est fixée dans l'Inspector (champ Question > Expected Answer).
    public CardData ExpectedAnswer => question != null ? question.expectedAnswer : null;

    // Lignes jouées tant que la question n'est pas résolue, puis lignes "post-aide" une fois résolue.
    // Si resolvedLines est vide, on retombe sur dialogueLines pour ne jamais avoir un PNJ muet.
    private string[] ActiveLines =>
        IsResolved && resolvedLines != null && resolvedLines.Length > 0 ? resolvedLines : dialogueLines;

    public void SetCardDatabase(CardDatabase db) => cardDatabase = db;

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
                if (HasUnansweredQuestion()) PresentQuestion();
                else EndDialogue();
                break;
        }
    }

    private bool HasUnansweredQuestion()
    {
        return question != null && question.expectedAnswer != null && !IsResolved;
    }

    private void StartDialogue()
    {
        string[] lines = ActiveLines;
        if (lines.Length == 0) return;
        currentLine = 0;
        state = State.ShowingLines;
        DialogueBox.Instance.Show(npcName, lines[currentLine], portrait, this);
    }

    private void AdvanceLine()
    {
        string[] lines = ActiveLines;
        if (currentLine < lines.Length - 1)
        {
            currentLine++;
            DialogueBox.Instance.Show(npcName, lines[currentLine], portrait, this);
            return;
        }

        if (HasUnansweredQuestion())
        {
            PresentQuestion();
        }
        else if (choices != null && choices.Length > 0)
        {
            PresentChoices();
        }
        else
        {
            EndDialogue();
        }
    }

    private void PresentQuestion()
    {
        if (cardDatabase == null)
        {
            Debug.LogWarning($"[NPC {npcName}] No CardDatabase assigned, can't present question.");
            EndDialogue();
            return;
        }

        state = State.AwaitingAnswer;
        DeckUI.Instance.Open(cardDatabase.AllCards, OnCardPicked, "Quelle carte répond à sa question ?");
    }

    private void OnCardPicked(CardData picked)
    {
        if (picked == question.expectedAnswer)
        {
            IsResolved = true;
            GetPlayerDeck()?.Add(picked);
            state = State.ShowingResponse;
            DialogueBox.Instance.Show(npcName, question.thanksLine, portrait, this);
            OnQuestionResolved?.Invoke(this);
        }
        else
        {
            state = State.ShowingResponse;
            DialogueBox.Instance.Show(npcName, question.hintLine, portrait, this);
        }
    }

    private void PresentChoices()
    {
        state = State.ShowingChoices;
        string[] options = new string[choices.Length];
        for (int i = 0; i < choices.Length; i++) options[i] = choices[i].optionText;
        DialogueBox.Instance.ShowChoices(npcName, ActiveLines[currentLine], options, OnChoicePicked, portrait, this);
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

    private Deck GetPlayerDeck()
    {
        if (cachedPlayerDeck != null) return cachedPlayerDeck;
        GameObject player = GameObject.FindGameObjectWithTag("Player");
        if (player != null) cachedPlayerDeck = player.GetComponent<Deck>();
        return cachedPlayerDeck;
    }
}
