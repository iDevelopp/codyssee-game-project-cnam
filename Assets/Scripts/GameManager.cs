using System;
using System.Collections.Generic;
using UnityEngine;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    [SerializeField] private CardDatabase cardDatabase;
    [SerializeField] private List<NPC> npcs = new List<NPC>();

    public event Action OnAllNPCsHelped;
    public CardDatabase Database => cardDatabase;
    public int NPCsHelped { get; private set; }
    public int NPCsTotal => questNPCCount;

    // Nombre de PNJ qui ont réellement une question à résoudre (≠ npcs.Count, qui peut
    // contenir des PNJ purement décoratifs sans Expected Answer).
    private int questNPCCount;

    private void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
    }

    private void Start()
    {
        if (cardDatabase == null)
        {
            Debug.LogError("[GameManager] CardDatabase non assignée !");
            return;
        }

        Deck playerDeck = FindPlayerDeck();
        if (playerDeck == null)
        {
            Debug.LogError("[GameManager] Pas de GameObject taggé 'Player' avec un composant Deck.");
            return;
        }

        // Chaque PNJ déclare sa propre carte-réponse dans l'Inspector.
        // Le deck initial = toutes les cartes SAUF celles que les PNJ vont apprendre au joueur,
        // pour que chaque bonne réponse soit une carte réellement nouvelle.
        List<CardData> answerCards = new List<CardData>();
        questNPCCount = 0;
        foreach (NPC npc in npcs)
        {
            if (npc == null) continue;
            CardData answer = npc.ExpectedAnswer;
            if (answer == null)
            {
                Debug.LogWarning($"[GameManager] Le PNJ '{npc.name}' n'a pas de réponse attendue assignée — il n'aura pas de question et ne compte pas pour ouvrir la sortie.");
                continue;
            }
            questNPCCount++;
            if (!answerCards.Contains(answer)) answerCards.Add(answer);
        }

        List<CardData> initialDeck = cardDatabase.GetComplement(answerCards);
        playerDeck.SetCards(initialDeck);
        Debug.Log($"[GameManager] Deck initial : {FormatCards(initialDeck)}");
        Debug.Log($"[GameManager] Réponses attendues (PNJ) : {FormatCards(answerCards)}");

        foreach (NPC npc in npcs)
        {
            if (npc == null) continue;
            npc.SetCardDatabase(cardDatabase);
            npc.OnQuestionResolved += HandleNPCResolved;
        }

        Debug.Log($"[GameManager] {questNPCCount} PNJ avec une question à résoudre pour ouvrir la sortie (liste : {npcs.Count} PNJ).");
        if (questNPCCount == 0)
            Debug.LogWarning("[GameManager] Aucun PNJ n'a de question : vérifie que la liste 'npcs' est remplie et que chaque PNJ a une Expected Answer.");
    }

    private void HandleNPCResolved(NPC npc)
    {
        NPCsHelped++;
        Debug.Log($"[GameManager] {NPCsHelped}/{questNPCCount} PNJ aidés.");
        if (NPCsHelped >= questNPCCount)
        {
            Debug.Log("[GameManager] Tous les PNJ ont été aidés !");
            OnAllNPCsHelped?.Invoke();
        }
    }

    private Deck FindPlayerDeck()
    {
        GameObject player = GameObject.FindGameObjectWithTag("Player");
        return player != null ? player.GetComponent<Deck>() : null;
    }

    private static string FormatCards(IEnumerable<CardData> cards)
    {
        List<string> names = new List<string>();
        foreach (CardData c in cards) names.Add(c.DisplayName);
        return string.Join(", ", names);
    }
}
