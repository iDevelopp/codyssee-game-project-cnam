using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

public class DialogueBox : MonoBehaviour
{
    public static DialogueBox Instance { get; private set; }

    public bool IsOpen => panel != null && panel.activeSelf;
    public bool IsChoosing => onChoiceMade != null;
    public object CurrentOwner { get; private set; }

    private GameObject panel;
    private Image portraitImage;
    private Text speakerText;
    private Text lineText;
    private GameObject[] choiceButtons;
    private Text[] choiceTexts;
    private Action<int> onChoiceMade;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    private static void AutoSpawn()
    {
        if (Instance != null) return;
        GameObject go = new GameObject("[DialogueBox]");
        DontDestroyOnLoad(go);
        go.AddComponent<DialogueBox>();
    }

    private void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
        EnsureEventSystem();
        BuildUI();
        panel.SetActive(false);
    }

    private void EnsureEventSystem()
    {
        if (EventSystem.current != null) return;
        GameObject es = new GameObject("[EventSystem]");
        es.AddComponent<EventSystem>();
        es.AddComponent<InputSystemUIInputModule>();
        DontDestroyOnLoad(es);
    }

    private void BuildUI()
    {
        Canvas canvas = gameObject.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 100;

        CanvasScaler scaler = gameObject.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);

        gameObject.AddComponent<GraphicRaycaster>();

        panel = new GameObject("Panel");
        panel.transform.SetParent(transform, false);
        Image bg = panel.AddComponent<Image>();
        bg.color = Color.white;
        RectTransform panelRect = bg.rectTransform;
        panelRect.anchorMin = new Vector2(0.1f, 0.05f);
        panelRect.anchorMax = new Vector2(0.9f, 0.3f);
        panelRect.offsetMin = Vector2.zero;
        panelRect.offsetMax = Vector2.zero;

        Font font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

        GameObject portraitGO = new GameObject("Portrait");
        portraitGO.transform.SetParent(panel.transform, false);
        portraitImage = portraitGO.AddComponent<Image>();
        portraitImage.preserveAspect = true;
        RectTransform portraitRect = portraitImage.rectTransform;
        portraitRect.anchorMin = new Vector2(0.01f, 0.05f);
        portraitRect.anchorMax = new Vector2(0.19f, 0.95f);
        portraitRect.offsetMin = Vector2.zero;
        portraitRect.offsetMax = Vector2.zero;
        portraitGO.SetActive(false);

        GameObject speakerGO = new GameObject("Speaker");
        speakerGO.transform.SetParent(panel.transform, false);
        speakerText = speakerGO.AddComponent<Text>();
        speakerText.font = font;
        speakerText.color = Color.black;
        speakerText.fontStyle = FontStyle.Bold;
        speakerText.fontSize = 32;
        speakerText.alignment = TextAnchor.MiddleLeft;
        RectTransform speakerRect = speakerText.rectTransform;
        speakerRect.anchorMin = new Vector2(0f, 0.75f);
        speakerRect.anchorMax = new Vector2(1f, 1f);
        speakerRect.offsetMin = new Vector2(30, 0);
        speakerRect.offsetMax = new Vector2(-30, -10);

        GameObject lineGO = new GameObject("Line");
        lineGO.transform.SetParent(panel.transform, false);
        lineText = lineGO.AddComponent<Text>();
        lineText.font = font;
        lineText.color = Color.black;
        lineText.fontSize = 26;
        lineText.alignment = TextAnchor.UpperLeft;
        lineText.horizontalOverflow = HorizontalWrapMode.Wrap;
        lineText.verticalOverflow = VerticalWrapMode.Truncate;
        RectTransform lineRect = lineText.rectTransform;
        lineRect.anchorMin = new Vector2(0f, 0.30f);
        lineRect.anchorMax = new Vector2(1f, 0.75f);
        lineRect.offsetMin = new Vector2(30, 0);
        lineRect.offsetMax = new Vector2(-30, 0);

        choiceButtons = new GameObject[3];
        choiceTexts = new Text[3];
        for (int i = 0; i < 3; i++)
        {
            GameObject btnGO = new GameObject($"ChoiceBox_{i}");
            btnGO.transform.SetParent(transform, false);
            Image btnBg = btnGO.AddComponent<Image>();
            btnBg.color = Color.white;
            Button btn = btnGO.AddComponent<Button>();
            int idx = i;
            btn.onClick.AddListener(() => OnChoiceClicked(idx));

            RectTransform rect = btn.GetComponent<RectTransform>();
            float yMin = 0.55f - i * 0.10f;
            rect.anchorMin = new Vector2(0.35f, yMin);
            rect.anchorMax = new Vector2(0.65f, yMin + 0.08f);
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;

            GameObject txtGO = new GameObject("Text");
            txtGO.transform.SetParent(btnGO.transform, false);
            Text txt = txtGO.AddComponent<Text>();
            txt.font = font;
            txt.fontSize = 24;
            txt.color = Color.black;
            txt.alignment = TextAnchor.MiddleCenter;
            txt.horizontalOverflow = HorizontalWrapMode.Wrap;
            choiceTexts[i] = txt;
            RectTransform txtRect = txt.rectTransform;
            txtRect.anchorMin = new Vector2(0.05f, 0);
            txtRect.anchorMax = new Vector2(0.95f, 1);
            txtRect.offsetMin = Vector2.zero;
            txtRect.offsetMax = Vector2.zero;

            choiceButtons[i] = btnGO;
            btnGO.SetActive(false);
        }
    }

    public void SetChoiceBoxSprite(int index, Sprite sprite)
    {
        if (choiceButtons == null || index < 0 || index >= choiceButtons.Length) return;
        Image img = choiceButtons[index].GetComponent<Image>();
        img.sprite = sprite;
        img.color = sprite != null ? Color.white : Color.white;
    }

    public void Show(string speaker, string line, Sprite portrait = null, object owner = null)
    {
        CurrentOwner = owner;
        speakerText.text = speaker;
        lineText.text = line;
        SetPortrait(portrait);
        HideChoiceButtons();
        ApplyLayout(withPortrait: portrait != null);
        panel.SetActive(true);
    }

    public void ShowChoices(string speaker, string prompt, string[] options, Action<int> callback, Sprite portrait = null, object owner = null)
    {
        CurrentOwner = owner;
        speakerText.text = speaker;
        lineText.text = prompt;
        SetPortrait(portrait);
        onChoiceMade = callback;
        ApplyLayout(withPortrait: portrait != null);

        int shown = Mathf.Min(options.Length, choiceButtons.Length);
        for (int i = 0; i < choiceButtons.Length; i++)
        {
            if (i < shown)
            {
                choiceButtons[i].SetActive(true);
                choiceTexts[i].text = options[i];
            }
            else
            {
                choiceButtons[i].SetActive(false);
            }
        }
        panel.SetActive(true);
    }

    public void Hide()
    {
        HideChoiceButtons();
        SetPortrait(null);
        CurrentOwner = null;
        panel.SetActive(false);
    }

    private void HideChoiceButtons()
    {
        onChoiceMade = null;
        if (choiceButtons == null) return;
        foreach (var btn in choiceButtons) btn.SetActive(false);
    }

    private void SetPortrait(Sprite sprite)
    {
        if (sprite == null)
        {
            portraitImage.gameObject.SetActive(false);
        }
        else
        {
            portraitImage.sprite = sprite;
            portraitImage.gameObject.SetActive(true);
        }
    }

    private void ApplyLayout(bool withPortrait)
    {
        float leftAnchor = withPortrait ? 0.21f : 0f;
        float leftPad = withPortrait ? 10f : 30f;

        RectTransform speakerRect = speakerText.rectTransform;
        speakerRect.anchorMin = new Vector2(leftAnchor, 0.75f);
        speakerRect.anchorMax = new Vector2(1f, 1f);
        speakerRect.offsetMin = new Vector2(leftPad, 0);
        speakerRect.offsetMax = new Vector2(-30, -10);

        RectTransform lineRect = lineText.rectTransform;
        lineRect.anchorMin = new Vector2(leftAnchor, 0.05f);
        lineRect.anchorMax = new Vector2(1f, 0.75f);
        lineRect.offsetMin = new Vector2(leftPad, 20);
        lineRect.offsetMax = new Vector2(-30, 0);
    }

    private void OnChoiceClicked(int index)
    {
        Action<int> cb = onChoiceMade;
        HideChoiceButtons();
        cb?.Invoke(index);
    }
}
