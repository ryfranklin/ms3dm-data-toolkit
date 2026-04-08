# Pipeline Refresh Guide

## Issue: New Pipeline Not Showing in Dagu

When you create a new quality pipeline through the Pipeline Builder, the YAML file is saved to the `dags/` directory. However, Dagu may not immediately show the new pipeline in its UI.

## Why This Happens

Dagu reads the DAG files from disk when it starts up. It doesn't automatically watch for new files being added. So when you create a new pipeline, Dagu needs to be told to reload its DAG list.

## Solution Options

### Option 1: Restart Dagu Container (Recommended)

```bash
docker restart ms3dm_dagu
```

Wait about 5-10 seconds, then refresh the Dagu UI in your browser. Your new pipeline will appear.

### Option 2: Refresh Dagu UI

Sometimes simply refreshing the Dagu web UI (http://localhost:8080) is enough. Try a hard refresh:
- **Mac**: `Cmd + Shift + R`
- **Windows/Linux**: `Ctrl + Shift + R`

### Option 3: Restart All Services

If Option 1 doesn't work, restart all services:

```bash
docker-compose restart
```

## Workflow

1. **Create Pipeline** → Use the Pipeline Builder UI to create a new quality pipeline
2. **Check File Created** → The YAML file is saved to `dags/dq_<pipeline_name>_quality_pipeline.yaml`
3. **Restart Dagu** → Run `docker restart ms3dm_dagu`
4. **Wait** → Give it 5-10 seconds to fully restart
5. **Refresh Browser** → Refresh the Dagu UI at http://localhost:8080
6. **Find Pipeline** → Your new pipeline should now be visible in the DAG list

## Verification

After restarting Dagu, you can verify it picked up your new DAG by checking the logs:

```bash
docker logs ms3dm_dagu --tail 20
```

You should see messages like:
```
level=INFO msg="Scheduler initialization" dir=/var/lib/dagu/dags
level=INFO msg="Server is starting" addr=0.0.0.0:8080
```

## Common Issues

### Pipeline File Doesn't Exist

If Dagu still can't find your pipeline after restarting, verify the file was actually created:

```bash
# Check local filesystem
ls -la dags/*<pipeline_name>*

# Check inside Dagu container
docker exec ms3dm_dagu ls -la /var/lib/dagu/dags/
```

### Invalid YAML Syntax

If the pipeline appears but can't be opened, there may be a syntax error in the YAML file. Check Dagu logs:

```bash
docker logs ms3dm_dagu | grep -i error
```

### Volume Mount Issue

Ensure the `dags/` directory is properly mounted in `docker-compose.yaml`:

```yaml
dagu:
  volumes:
    - ./dags:/var/lib/dagu/dags
```

## Automation Ideas

### Future Enhancement: Auto-Restart API

We could add a backend API endpoint that triggers a Dagu restart after creating a pipeline:

```python
# In backend/api/quality.py
@quality_bp.route('/pipeline/restart-dagu', methods=['POST'])
def restart_dagu():
    try:
        subprocess.run(['docker', 'restart', 'ms3dm_dagu'], check=True)
        return jsonify({'success': True, 'message': 'Dagu restarted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
```

Then call this from the frontend after successfully creating a pipeline:

```javascript
// After successful pipeline creation
await axios.post('http://localhost:8000/api/quality/pipeline/restart-dagu');
// Show message to user: "Pipeline created and Dagu restarted"
```

### Alternative: Dagu Watcher

Dagu has a `--watch` flag that can monitor the DAG directory for changes. This could be added to the `dagu-entrypoint.sh`:

```bash
# Start Dagu with watch mode
exec dagu start-all --watch
```

However, this feature may not be available in all Dagu versions.

## Best Practices

1. **After Creating Pipeline** → Always restart Dagu or refresh the UI
2. **Check Logs** → If issues persist, check Dagu logs for errors
3. **Verify File** → Ensure the YAML file was created correctly
4. **Test Pipeline** → Once visible, do a test run before relying on it
5. **Name Carefully** → Use descriptive pipeline names to easily identify them in the UI

## Summary

**Quick Fix**: Run `docker restart ms3dm_dagu` and refresh your browser after creating a new pipeline!
