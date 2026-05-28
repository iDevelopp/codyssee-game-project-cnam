using UnityEngine;

public class CameraFollow : MonoBehaviour
{
    [SerializeField] private Transform target;
    [SerializeField] private Vector2 offset = Vector2.zero;
    [SerializeField] private float smoothTime = 0.15f;

    private Vector3 velocity;
    private float fixedZ;

    private void Awake()
    {
        fixedZ = transform.position.z;
    }

    private void Start()
    {
        if (target == null)
        {
            GameObject player = GameObject.FindGameObjectWithTag("Player");
            if (player != null) target = player.transform;
        }
    }

    private void LateUpdate()
    {
        if (target == null) return;

        Vector3 desired = new Vector3(
            target.position.x + offset.x,
            target.position.y + offset.y,
            fixedZ);

        transform.position = Vector3.SmoothDamp(transform.position, desired, ref velocity, smoothTime);
    }
}
