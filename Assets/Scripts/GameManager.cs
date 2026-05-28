using System;
using System.Collections.Generic;
using UnityEngine;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    [SerializeField] private CardDatabase cardDatabase;
    [SerializeField] private int initialDeckSize = 3;
    [SerializeField] private List<NPC> npcs = new List<NPC>();

    public event Action OnAllNPCsHelped;
    public CardDatabase Database => cardDatabase;
    public int NPCsHelped { get; private set; }
    public int NPCsTotal => npcs.Count;

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

        List<CardData> initialDeck = cardDatabase.PickRandom(initialDeckSize);
        playerDeck.SetCards(initialDeck);
        Debug.Log($"[GameManager] Deck initial : {FormatCards(initialDeck)}");

        List<CardData> complement = cardDatabase.GetComplement(initialDeck);
        Shuffle(complement);
        Debug.Log($"[GameManager] Cartes manquantes (questions PNJ) : {FormatCards(complement)}");

        if (npcs.Count > complement.Count)
        {
            Debug.LogWarning($"[GameManager] {npcs.Count} PNJ mais seulement {complement.Count} cartes manquantes — certains PNJ n'auront pas de question.");
        }

        for (int i = 0; i < npcs.Count; i++)
        {
            NPC npc = npcs[i];
            if (npc == null) continue;
            if (i < complement.Count) npc.SetExpectedAnswer(complement[i]);
            npc.SetCardDatabase(cardDatabase);
            npc.OnQuestionResolved += HandleNPCResolved;
        }
    }

    private void HandleNPCResolved(NPC npc)
    {
        NPCsHelped++;
        Debug.Log($"[GameManager] {NPCsHelped}/{npcs.Count} PNJ aidés.");
        if (NPCsHelped >= npcs.Count)
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

    private static void Shuffle<T>(IList<T> list)
    {
        for (int i = list.Count - 1; i > 0; i--)
        {
            int j = UnityEngine.Random.Range(0, i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
    }

    private static string FormatCards(IEnumerable<CardData> cards)
    {
        List<string> names = new List<string>();
        foreach (CardData c in cards) names.Add(c.DisplayName);
        return string.Join(", ", names);
    }
}
